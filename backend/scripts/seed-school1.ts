/**
 * Сидер тестовых данных «Школа №1 г. Москва» в реальную БД.
 *
 * Запуск (из папки backend, при поднятой БД из .env):
 *   npx ts-node scripts/seed-school1.ts
 *
 * Создаёт (или переиспользует по имени) школу, админа, предметы, кабинеты,
 * классы (33), учителей (~51) и всегда добавляет НОВУЮ версию расписания
 * с полной нагрузкой (~900 уроков/нед) — чтобы протестировать автосоставление.
 *
 * Вход в приложение после сидирования:
 *   Пароль школы: school123   Админ: «Иванов Иван Иванович» / admin123
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { School } from '../src/modules/schools/entities/school.entity';
import { Admin } from '../src/modules/admins/entities/admin.entity';
import { Subject } from '../src/modules/schedule/entities/subject.entity';
import { Room } from '../src/modules/schedule/entities/room.entity';
import { SchoolClass } from '../src/modules/schedule/entities/school-class.entity';
import { Teacher } from '../src/modules/schedule/entities/teacher.entity';
import { ScheduleVersion } from '../src/modules/schedule/entities/schedule-version.entity';
import { BellSchedule } from '../src/modules/schedule/entities/bell-schedule.entity';
import { Workload } from '../src/modules/schedule/entities/workload.entity';
import { buildDataset, datasetSummary } from './school1-dataset';

async function main() {
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
    const ds = app.get(DataSource);
    const data = buildDataset();
    console.log(datasetSummary(data));

    const schoolRepo = ds.getRepository(School);
    const adminRepo = ds.getRepository(Admin);
    const subjectRepo = ds.getRepository(Subject);
    const roomRepo = ds.getRepository(Room);
    const classRepo = ds.getRepository(SchoolClass);
    const teacherRepo = ds.getRepository(Teacher);
    const versionRepo = ds.getRepository(ScheduleVersion);
    const bellRepo = ds.getRepository(BellSchedule);
    const workloadRepo = ds.getRepository(Workload);

    // 1) Школа + админ (переиспользуем по имени)
    let school = await schoolRepo.findOne({ where: { name: data.schoolName } });
    if (!school) {
        school = await schoolRepo.save(schoolRepo.create({ name: data.schoolName, passwordHash: await bcrypt.hash('school123', 10) }));
        await adminRepo.save(adminRepo.create({ schoolId: school.id, fullName: 'Иванов Иван Иванович', passwordHash: await bcrypt.hash('admin123', 10) } as any));
        console.log(`✔ Создана школа «${school.name}» (пароль school123, админ Иванов Иван Иванович / admin123)`);
    } else {
        console.log(`✔ Используется существующая школа «${school.name}» (id=${school.id})`);
    }
    const schoolId = school.id;

    // helper: reuse-by-name
    const upsertMany = async <T extends { id?: number }>(
        repo: any, existing: T[], keyOf: (x: any) => string, rows: any[], makeKey: (r: any) => string,
    ): Promise<Map<number, T>> => {
        const byKey = new Map(existing.map((e) => [keyOf(e), e]));
        const tempToReal = new Map<number, T>();
        for (const r of rows) {
            let ent = byKey.get(makeKey(r));
            if (!ent) { ent = await repo.save(repo.create(r.payload)); byKey.set(makeKey(r), ent!); }
            tempToReal.set(r.tempId, ent!);
        }
        return tempToReal;
    };

    // 2) Предметы
    const subjMap = await upsertMany<Subject>(
        subjectRepo,
        await subjectRepo.find({ where: { schoolId } }),
        (e) => e.name,
        data.subjects.map((s) => ({ tempId: s.id, payload: { schoolId, name: s.name, shortName: s.shortName, color: s.color, sanpinCategory: s.sanpinCategory as any, difficulty: s.difficulty } })),
        (r) => r.payload.name,
    );

    // 3) Кабинеты
    const roomMap = await upsertMany<Room>(
        roomRepo,
        await roomRepo.find({ where: { schoolId } }),
        (e) => e.name,
        data.rooms.map((r) => ({ tempId: r.id, payload: { schoolId, name: r.name, capacity: r.capacity, floor: r.floor, type: r.type as any } })),
        (r) => r.payload.name,
    );

    // 4) Классы
    const classMap = await upsertMany<SchoolClass>(
        classRepo,
        await classRepo.find({ where: { schoolId } }),
        (e) => e.name,
        data.classes.map((c) => ({ tempId: c.id, payload: { schoolId, name: c.name, gradeLevel: c.gradeLevel, studentsCount: c.studentsCount, color: c.color, shift: c.shift } })),
        (r) => r.payload.name,
    );

    // 5) Учителя (+ связь с предметами)
    const existingTeachers = await teacherRepo.find({ where: { schoolId } });
    const teacherByName = new Map(existingTeachers.map((t) => [t.fullName, t]));
    const teacherMap = new Map<number, Teacher>();
    for (const t of data.teachers) {
        let ent = teacherByName.get(t.fullName);
        if (!ent) {
            const subjects = t.subjectIds.map((sid) => subjMap.get(sid)!).filter(Boolean);
            ent = await teacherRepo.save(teacherRepo.create({ schoolId, fullName: t.fullName, shortName: t.shortName, color: t.color, subjects }) as unknown as Teacher);
            teacherByName.set(t.fullName, ent!);
        }
        teacherMap.set(t.id, ent!);
    }
    console.log(`✔ Справочники: предметов ${subjMap.size}, кабинетов ${roomMap.size}, классов ${classMap.size}, учителей ${teacherMap.size}`);

    // 6) Новая версия расписания (всегда свежая)
    const stamp = new Date().toLocaleString('ru-RU');
    const version = await versionRepo.save(versionRepo.create({
        schoolId, name: `${data.version.name} (${stamp})`, type: data.version.type as any,
        weekType: data.version.weekType as any, status: 'draft' as any,
        workingDays: data.version.workingDays, maxLessonsPerDay: data.version.maxLessonsPerDay,
        institutionType: 'school',
    }) as unknown as ScheduleVersion);
    console.log(`✔ Создана версия расписания «${version.name}» (id=${version.id})`);

    // 7) Звонки для версии
    const bells = data.bells.map((b) => bellRepo.create({ schoolId, versionId: version.id, lessonNumber: b.lessonNumber, startTime: b.startTime, endTime: b.endTime, breakAfter: b.breakAfter }) as unknown as BellSchedule);
    await bellRepo.save(bells);

    // 8) Нагрузки
    const workloads = data.workloads.map((w) => workloadRepo.create({
        versionId: version.id,
        classId: classMap.get(w.classId)!.id,
        subjectId: subjMap.get(w.subjectId)!.id,
        teacherId: teacherMap.get(w.teacherId)!.id,
        hoursPerWeek: w.hoursPerWeek,
        weekType: 'both' as any,
        difficulty: w.difficulty,
    }) as unknown as Workload);
    await workloadRepo.save(workloads, { chunk: 100 });
    const totalHours = data.workloads.reduce((s, w) => s + w.hoursPerWeek, 0);
    console.log(`✔ Добавлено нагрузок: ${workloads.length} (суммарно ${totalHours} уроков/нед)`);

    console.log('\n🎉 Готово. Войдите (пароль школы school123), откройте «Расписание» → версию');
    console.log(`   «${version.name}» → нажмите «Авто» для автосоставления.`);
    await app.close();
}

main().catch((e) => { console.error('Ошибка сидирования:', e); process.exit(1); });
