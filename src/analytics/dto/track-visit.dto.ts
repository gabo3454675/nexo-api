import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class TrackVisitDto {
  @ApiProperty({ example: 'visit-uuid-123' })
  @IsString()
  @MinLength(6)
  sessionId!: string;
}
