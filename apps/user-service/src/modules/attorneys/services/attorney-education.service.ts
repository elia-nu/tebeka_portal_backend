import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '../attorneys-shared/prisma';

@Injectable()
export class AttorneyEducationService {
  async addEducation(attorneyId: string, data: any) {
    // Resolve: the caller may pass either an AttorneyProfile.id or a User.id
    let profile = await prisma.attorneyProfile.findUnique({ where: { id: attorneyId } });
    if (!profile) {
      // Try resolving by userId
      profile = await prisma.attorneyProfile.findUnique({ where: { userId: attorneyId } });
    }
    if (!profile) {
      throw new NotFoundException(`Attorney profile not found for ID "${attorneyId}". Ensure you are passing the attorney profile ID, not the user ID.`);
    }

    return prisma.attorneyEducation.create({
      data: {
        attorneyId: profile.id,
        institution: data.institution,
        degree: data.degree,
        fieldOfStudy: data.fieldOfStudy || null,
        startYear: data.startYear ? Number(data.startYear) : null,
        endYear: data.endYear ? Number(data.endYear) : (data.graduationYear ? Number(data.graduationYear) : null),
        graduationYear: data.graduationYear ? Number(data.graduationYear) : (data.endYear ? Number(data.endYear) : null),
        degreeDocumentUrl: data.degreeDocumentUrl || null,
      }
    });
  }

  async getEducation(attorneyId: string) {
    return prisma.attorneyEducation.findMany({ where: { attorneyId } });
  }

  async deleteEducation(educationId: string) {
    const existing = await prisma.attorneyEducation.findUnique({ where: { id: educationId } });
    if (!existing) return { status: true, message: 'Education record deleted' };
    return prisma.attorneyEducation.delete({ where: { id: educationId } });
  }

  async removeEducation(attorneyId: string, educationId: string) {
    const existing = await prisma.attorneyEducation.findFirst({
      where: { id: educationId, attorneyId }
    });
    if (!existing) return { status: true, message: 'Education record deleted' };
    return prisma.attorneyEducation.delete({ where: { id: educationId } });
  }
}
