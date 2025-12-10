export interface IUser {
    id: number;
    schoolId: number;
    fullName: string;
    sessionToken: string;
    isAdmin: boolean;
    lastActive: Date;
}