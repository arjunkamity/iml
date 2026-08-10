import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthService } from '../auth/auth.service';
import { SchoolsService } from '../schools/schools.service';
import { RegisterStudentDto } from './dto/register-student.dto';
import type { JwtPayload } from '../auth/auth.types';

@Injectable()
export class StudentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthService,
    private readonly schools: SchoolsService,
  ) {}

  /** OTP-verified student self-registration. Returns an access token. */
  async register(dto: RegisterStudentDto) {
    const school = await this.schools.validateCode(dto.schoolCode);
    if (!school.valid || !school.schoolId) {
      throw new BadRequestException('Invalid or inactive school code');
    }

    const dupe = await this.db.queryOne<{ UserId: number }>(
      `SELECT UserId FROM dbo.Users WHERE Phone = @phone`,
      { phone: dto.phone },
    );
    if (dupe) {
      throw new ConflictException('A participant with this phone already exists');
    }

    // Validates + consumes the OTP; throws if invalid/expired.
    await this.auth.consumeOtp(dto.phone, dto.code);

    const userId = await this.db.transaction(async (tx) => {
      const user = await new this.db.sql.Request(tx)
        .input('schoolId', school.schoolId)
        .input('fullName', dto.fullName)
        .input('email', dto.email ?? null)
        .input('phone', dto.phone)
        .query<{ UserId: number }>(
          `INSERT INTO dbo.Users
             (RoleId, SchoolId, FullName, Email, Phone, PhoneVerified, Status)
           OUTPUT INSERTED.UserId
           VALUES (3, @schoolId, @fullName, @email, @phone, 1, N'Active')`,
        );
      const newId = user.recordset[0].UserId;

      await new this.db.sql.Request(tx)
        .input('userId', newId)
        .input('grade', dto.grade ?? null)
        .input('section', dto.section ?? null)
        .input('parentName', dto.parentName ?? null)
        .input('parentPhone', dto.parentPhone ?? null)
        .input('parentEmail', dto.parentEmail ?? null)
        .input('city', dto.city ?? null)
        .query(
          `INSERT INTO dbo.StudentProfiles
             (UserId, Grade, Section, ParentName, ParentPhone, ParentEmail, City, ConsentGiven)
           VALUES (@userId, @grade, @section, @parentName, @parentPhone, @parentEmail, @city, 1)`,
        );

      return newId;
    });

    return this.auth.issueTokenForUserId(userId);
  }

  /** List students for a school (coordinator: own school; admin: any). */
  async listForUser(user: JwtPayload, schoolId?: number) {
    const targetSchool = user.role === 'COORDINATOR' ? user.schoolId : schoolId;
    return this.db.query(
      `SELECT u.UserId, u.FullName, u.Email, u.Phone, u.Status, u.CreatedAt,
              sp.Grade, sp.Section, sp.ParentName, sp.ParentPhone, sp.City,
              s.SchoolCode, s.Name AS SchoolName
         FROM dbo.Users u
         JOIN dbo.Schools s ON s.SchoolId = u.SchoolId
         LEFT JOIN dbo.StudentProfiles sp ON sp.UserId = u.UserId
        WHERE u.RoleId = 3
          AND (@schoolId IS NULL OR u.SchoolId = @schoolId)
        ORDER BY u.CreatedAt DESC`,
      { schoolId: targetSchool ?? null },
    );
  }

  async getProfile(userId: number) {
    return this.db.queryOne(
      `SELECT u.UserId, u.FullName, u.Email, u.Phone,
              sp.Grade, sp.Section, sp.DateOfBirth, sp.ParentName, sp.ParentPhone, sp.ParentEmail, sp.City,
              s.SchoolCode, s.Name AS SchoolName
         FROM dbo.Users u
         JOIN dbo.Schools s ON s.SchoolId = u.SchoolId
         LEFT JOIN dbo.StudentProfiles sp ON sp.UserId = u.UserId
        WHERE u.UserId = @id`,
      { id: userId },
    );
  }
}
