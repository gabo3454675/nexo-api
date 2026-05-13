import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@nexo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Nexo1234!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Usuario NEXO', required: false })
  @IsOptional()
  @IsString()
  name?: string;
}
