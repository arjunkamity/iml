import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { CreateSchoolDto } from './dto/create-school.dto';

@Injectable()
export class SchoolsService {
  constructor(private readonly db: DatabaseService) {}

  private codePrefix(city?: string): string {
    const letters = (city ?? '').replace(/[^a-zA-Z]/g, '');
    return (letters.slice(0, 3) || 'GEN').toUpperCase();
  }

  async create(dto: CreateSchoolDto) {
    const existing = await this.db.queryOne<{ UserId: number }>(
      `SELECT UserId FROM dbo.Users WHERE Email = @email`,
      { email: dto.coordinator.email },
    );
    if (existing) {
      throw new ConflictException('Coordinator email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.coordinator.password, 10);

    return this.db.transaction(async (tx) => {
      // Insert with a temporary unique code, then set the real IML code from the id.
      const inserted = await new this.db.sql.Request(tx)
        .input('name', dto.name)
        .input('city', dto.city ?? null)
        .input('state', dto.state ?? null)
        .input('address', dto.address ?? null)
        .input('contactEmail', dto.contactEmail ?? null)
        .input('contactPhone', dto.contactPhone ?? null)
        .query<{ SchoolId: number }>(
          `INSERT INTO dbo.Schools
             (SchoolCode, Name, City, State, Address, ContactEmail, ContactPhone, Status)
           OUTPUT INSERTED.SchoolId
           VALUES (LEFT(CONVERT(NVARCHAR(36), NEWID()), 20),
                   @name, @city, @state, @address, @contactEmail, @contactPhone, N'Active')`,
        );
      const schoolId = inserted.recordset[0].SchoolId;
      const schoolCode = `IML-${this.codePrefix(dto.city)}-${String(schoolId).padStart(4, '0')}`;

      await new this.db.sql.Request(tx)
        .input('code', schoolCode)
        .input('id', schoolId)
        .query(`UPDATE dbo.Schools SET SchoolCode = @code WHERE SchoolId = @id`);

      const coord = await new this.db.sql.Request(tx)
        .input('schoolId', schoolId)
        .input('fullName', dto.coordinator.fullName)
        .input('email', dto.coordinator.email)
        .input('phone', dto.coordinator.phone ?? null)
        .input('passwordHash', passwordHash)
        .query<{ UserId: number }>(
          `INSERT INTO dbo.Users
             (RoleId, SchoolId, FullName, Email, Phone, PasswordHash, EmailVerified, Status)
           OUTPUT INSERTED.UserId
           VALUES (2, @schoolId, @fullName, @email, @phone, @passwordHash, 1, N'Active')`,
        );

      return {
        schoolId,
        schoolCode,
        coordinatorUserId: coord.recordset[0].UserId,
      };
    });
  }

  async list() {
    return this.db.query(
      `SELECT s.SchoolId, s.SchoolCode, s.Name, s.City, s.State, s.Status, s.CreatedAt,
              (SELECT COUNT(*) FROM dbo.Users u WHERE u.SchoolId = s.SchoolId AND u.RoleId = 3) AS StudentCount
         FROM dbo.Schools s
        ORDER BY s.CreatedAt DESC`,
    );
  }

  async getById(schoolId: number) {
    const school = await this.db.queryOne(
      `SELECT SchoolId, SchoolCode, Name, City, State, Address, ContactEmail, ContactPhone, Status, CreatedAt
         FROM dbo.Schools WHERE SchoolId = @id`,
      { id: schoolId },
    );
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  /** Public: validate a school code during student registration. */
  async validateCode(code: string) {
    if (!code) throw new BadRequestException('School code required');
    const row = await this.db.queryOne<{ SchoolId: number; Name: string }>(
      `SELECT SchoolId, Name FROM dbo.Schools WHERE SchoolCode = @code AND Status = N'Active'`,
      { code },
    );
    return row
      ? { valid: true, schoolId: row.SchoolId, schoolName: row.Name }
      : { valid: false };
  }
}
