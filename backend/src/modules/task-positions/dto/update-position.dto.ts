import { IsNumber, Min } from 'class-validator';

export class UpdatePositionDto {
    @IsNumber()
    @Min(0)
    x: number;

    @IsNumber()
    @Min(0)
    y: number;
}
