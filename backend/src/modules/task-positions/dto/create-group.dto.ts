import { IsArray, ArrayMinSize, IsInt, Min } from 'class-validator';

export class CreateGroupDto {
    @IsArray()
    @ArrayMinSize(2)
    @IsInt({ each: true })
    taskIds: number[];

    @IsInt()
    @Min(0)
    x: number;

    @IsInt()
    @Min(0)
    y: number;
}