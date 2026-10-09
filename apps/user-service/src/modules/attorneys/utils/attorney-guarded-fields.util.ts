export async function evaluateAndRecordGuardedChanges(
  prisma: any,
  id: string,
  attorney: any,
  data: any
): Promise<any[]> {
  const guardedChanges: any[] = [];

  // a. Bar Number
  const newBarNumber =
    data.barRegistrationNumber !== undefined
      ? data.barRegistrationNumber
      : data.licenseNumber !== undefined
      ? data.licenseNumber
      : data.barNumber !== undefined
      ? data.barNumber
      : data.bar_registration_number !== undefined
      ? data.bar_registration_number
      : data.license_number;

  if (newBarNumber !== undefined && newBarNumber !== null && String(newBarNumber).trim() !== '') {
    const oldBarNumber = attorney.barRegistrationNumber || attorney.licenseNumber || '';
    if (String(newBarNumber) !== String(oldBarNumber)) {
      const gc = await prisma.guardedChange.create({
        data: {
          attorneyId: id,
          field: 'barRegistrationNumber',
          oldValue: String(oldBarNumber),
          newValue: String(newBarNumber),
          status: 'PENDING',
        },
      });
      guardedChanges.push(gc);
    }
  }

  // b. Practice Areas
  const rawPracticeAreas =
    data.practiceAreas !== undefined
      ? data.practiceAreas
      : data.practiceAreaIds !== undefined
      ? data.practiceAreaIds
      : data.practice_areas;

  if (rawPracticeAreas !== undefined && rawPracticeAreas !== null) {
    const parsedNewAreas: string[] = Array.isArray(rawPracticeAreas)
      ? rawPracticeAreas.map((a: any) => String(a).trim())
      : [String(rawPracticeAreas).trim()];
    const oldAreas: string[] = attorney.practiceAreas || [];
    if (JSON.stringify(parsedNewAreas) !== JSON.stringify(oldAreas)) {
      const gc = await prisma.guardedChange.create({
        data: {
          attorneyId: id,
          field: 'practiceAreas',
          oldValue: JSON.stringify(oldAreas),
          newValue: JSON.stringify(parsedNewAreas),
          status: 'PENDING',
        },
      });
      guardedChanges.push(gc);
    }
  }

  // c. Fee Band
  const newFeeBand =
    data.feeBand !== undefined
      ? data.feeBand
      : data.fee_band !== undefined
      ? data.fee_band
      : data.consultationFeeBand;

  if (newFeeBand !== undefined && newFeeBand !== null && String(newFeeBand).trim() !== '') {
    const oldFeeBand = attorney.feeBand || '';
    if (String(newFeeBand) !== String(oldFeeBand)) {
      const gc = await prisma.guardedChange.create({
        data: {
          attorneyId: id,
          field: 'feeBand',
          oldValue: String(oldFeeBand),
          newValue: String(newFeeBand),
          status: 'PENDING',
        },
      });
      guardedChanges.push(gc);
    }
  }

  // d. National ID Number
  const natIdNum = data.nationalIdNumber || data.nationalId || data.national_id_number;
  if (natIdNum !== undefined && natIdNum !== null && String(natIdNum).trim() !== '') {
    const oldNatId = attorney.nationalIdNumber || '';
    if (String(natIdNum) !== String(oldNatId)) {
      const gc = await prisma.guardedChange.create({
        data: {
          attorneyId: id,
          field: 'nationalIdNumber',
          oldValue: String(oldNatId),
          newValue: String(natIdNum),
          status: 'PENDING',
        },
      });
      guardedChanges.push(gc);
    }
  }

  // e. License Book URL
  const licenseBookUrl =
    data.licenseBookUrl ||
    data.licenseBookKey ||
    data.licenseBook ||
    data.license ||
    data.license_book_url;
  if (
    licenseBookUrl !== undefined &&
    licenseBookUrl !== null &&
    String(licenseBookUrl).trim() !== ''
  ) {
    const oldLicenseBook = attorney.licenseBookUrl || '';
    if (String(licenseBookUrl) !== String(oldLicenseBook)) {
      const gc = await prisma.guardedChange.create({
        data: {
          attorneyId: id,
          field: 'licenseBookUrl',
          oldValue: String(oldLicenseBook),
          newValue: String(licenseBookUrl),
          status: 'PENDING',
        },
      });
      guardedChanges.push(gc);

      let cred = await prisma.credential.findFirst({
        where: { attorneyId: id, credentialType: 'BAR_LICENSE' },
      });
      if (!cred) {
        cred = await prisma.credential.create({
          data: {
            attorneyId: id,
            credentialType: 'BAR_LICENSE',
            issuer: 'Federal Ministry of Justice',
            credentialNumber: (attorney as any).barRegistrationNumber || `BAR-${Date.now()}`,
            verificationStatus: 'SUBMITTED',
          },
        });
      }
      await prisma.credentialDocument.create({
        data: {
          credentialId: cred.id,
          fileKey: licenseBookUrl,
          mimeType: 'application/pdf',
          size: 1024,
        },
      });
    }
  }

  // f. Bar Registration URL
  const barRegistrationUrl =
    data.barRegistrationUrl ||
    data.barRegistrationKey ||
    data.barRegistration ||
    data.barCertificate ||
    data.bar_registration_url;
  if (
    barRegistrationUrl !== undefined &&
    barRegistrationUrl !== null &&
    String(barRegistrationUrl).trim() !== ''
  ) {
    const oldBarReg = attorney.barRegistrationUrl || '';
    if (String(barRegistrationUrl) !== String(oldBarReg)) {
      const gc = await prisma.guardedChange.create({
        data: {
          attorneyId: id,
          field: 'barRegistrationUrl',
          oldValue: String(oldBarReg),
          newValue: String(barRegistrationUrl),
          status: 'PENDING',
        },
      });
      guardedChanges.push(gc);

      let cred = await prisma.credential.findFirst({
        where: { attorneyId: id, credentialType: 'BAR_CERTIFICATE' },
      });
      if (!cred) {
        cred = await prisma.credential.create({
          data: {
            attorneyId: id,
            credentialType: 'BAR_CERTIFICATE',
            issuer: 'Federal Ministry of Justice',
            credentialNumber: (attorney as any).barRegistrationNumber || `BAR-${Date.now()}`,
            verificationStatus: 'SUBMITTED',
          },
        });
      }
      await prisma.credentialDocument.create({
        data: {
          credentialId: cred.id,
          fileKey: barRegistrationUrl,
          mimeType: 'application/pdf',
          size: 1024,
        },
      });
    }
  }

  // g. National ID Document URL
  const nationalIdDocumentUrl =
    data.nationalIdDocumentUrl ||
    data.nationalIdKey ||
    data.nationalIdDocument ||
    data.nationalIdUrl ||
    data.nationalIdCard ||
    data.identityCard ||
    data.national_id_document_url;
  if (
    nationalIdDocumentUrl !== undefined &&
    nationalIdDocumentUrl !== null &&
    String(nationalIdDocumentUrl).trim() !== ''
  ) {
    const oldNatDoc = attorney.nationalIdDocumentUrl || '';
    if (String(nationalIdDocumentUrl) !== String(oldNatDoc)) {
      const gc = await prisma.guardedChange.create({
        data: {
          attorneyId: id,
          field: 'nationalIdDocumentUrl',
          oldValue: String(oldNatDoc),
          newValue: String(nationalIdDocumentUrl),
          status: 'PENDING',
        },
      });
      guardedChanges.push(gc);

      let cred = await prisma.credential.findFirst({
        where: { attorneyId: id, credentialType: 'NATIONAL_ID' },
      });
      if (!cred) {
        cred = await prisma.credential.create({
          data: {
            attorneyId: id,
            credentialType: 'NATIONAL_ID',
            issuer: 'National ID Program',
            credentialNumber:
              natIdNum || (attorney as any).nationalIdNumber || `ID-${Date.now()}`,
            verificationStatus: 'SUBMITTED',
          },
        });
      }
      await prisma.credentialDocument.create({
        data: {
          credentialId: cred.id,
          fileKey: nationalIdDocumentUrl,
          mimeType: 'application/pdf',
          size: 1024,
        },
      });
    }
  }

  // h. Other Supporting Documents
  const otherDocs =
    data.otherSupportingDocuments ||
    data.otherDocuments ||
    data.supportingDocuments ||
    data.other_supporting_documents;
  if (otherDocs !== undefined && otherDocs !== null) {
    const parsedDocs = Array.isArray(otherDocs) ? otherDocs : [otherDocs];
    const oldDocs = attorney.otherSupportingDocuments || [];
    if (JSON.stringify(parsedDocs) !== JSON.stringify(oldDocs)) {
      const gc = await prisma.guardedChange.create({
        data: {
          attorneyId: id,
          field: 'otherSupportingDocuments',
          oldValue: JSON.stringify(oldDocs),
          newValue: JSON.stringify(parsedDocs),
          status: 'PENDING',
        },
      });
      guardedChanges.push(gc);
    }
  }

  return guardedChanges;
}
