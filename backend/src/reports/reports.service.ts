import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

interface DateRange {
  from?: string;
  to?: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOwnedFarm(farmId: string, userId: string) {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      include: {
        farmUsers: {
          where: { userId, isActive: true },
        },
      },
    });
    if (!farm) {
      throw new NotFoundException(`La granja con ID ${farmId} no existe.`);
    }

    const dbUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (dbUser?.globalRole === 'SUPER_ADMIN') {
      return farm;
    }

    const isOwner = farm.userId === userId;
    const isMember = farm.farmUsers && farm.farmUsers.length > 0;
    if (!isOwner && !isMember) {
      throw new ForbiddenException('No tienes acceso a este establecimiento.');
    }
    return farm;
  }

  private async getOwnedAnimal(animalId: string, userId: string) {
    const animal = await this.prisma.animal.findUnique({
      where: { id: animalId },
      include: {
        farm: {
          include: {
            farmUsers: {
              where: { userId, isActive: true },
            },
          },
        },
      },
    });
    if (!animal) {
      throw new NotFoundException(`El animal con ID ${animalId} no existe.`);
    }

    const dbUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (dbUser?.globalRole === 'SUPER_ADMIN') {
      return animal;
    }

    const isOwner = animal.farm.userId === userId;
    const isMember = animal.farm.farmUsers && animal.farm.farmUsers.length > 0;
    if (!isOwner && !isMember) {
      throw new ForbiddenException('No tienes acceso a este animal.');
    }
    return animal;
  }

  private dateFilter({ from, to }: DateRange) {
    if (!from && !to) return undefined;
    return {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(to) }),
    };
  }

  // ---------------------------------------------------------------------
  // 1. Historial médico de un animal (PDF)
  // ---------------------------------------------------------------------
  async animalMedicalHistoryPdf(animalId: string, userId: string): Promise<Buffer> {
    const animal = await this.getOwnedAnimal(animalId, userId);
    const events = await this.prisma.medicalEvent.findMany({
      where: { animalId },
      orderBy: { occurredAt: 'desc' },
    });

    const doc = new PDFDocument({ margin: 50 });
    doc.fontSize(18).text(`Historial médico — ${animal.tag ?? `Animal ${animal.id.slice(0, 8)}`}`, { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#666').text(`Raza: ${animal.breed} · Generado: ${new Date().toLocaleString()}`);
    doc.moveDown(1);
    doc.fillColor('#000');

    if (events.length === 0) {
      doc.fontSize(12).text('Este animal no tiene registros médicos.');
    } else {
      events.forEach((ev) => {
        doc.fontSize(12).text(`${new Date(ev.occurredAt).toLocaleDateString()} — ${ev.type ?? 'Otro'}`, {
          continued: false,
        });
        if (ev.value !== null) {
          doc.fontSize(10).fillColor('#333').text(`Valor: ${ev.value}`);
        }
        if (ev.description) {
          doc.fontSize(10).fillColor('#333').text(ev.description);
        }
        doc.fillColor('#000').moveDown(0.6);
      });
    }

    return this.finalizePdf(doc);
  }

  // ---------------------------------------------------------------------
  // 2. Listado de animales de una granja (Excel)
  // ---------------------------------------------------------------------
  async farmAnimalsExcel(farmId: string, userId: string): Promise<Buffer> {
    await this.getOwnedFarm(farmId, userId);
    const animals = await this.prisma.animal.findMany({
      where: { farmId },
      include: { animalType: true, zone: true, animalCollars: { where: { endAt: null }, include: { collar: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Animales');
    sheet.columns = [
      { header: 'Tag', key: 'tag', width: 20 },
      { header: 'Tipo', key: 'type', width: 18 },
      { header: 'Raza', key: 'breed', width: 18 },
      { header: 'Peso (Kg)', key: 'weight', width: 12 },
      { header: 'Zona', key: 'zone', width: 20 },
      { header: 'Collar', key: 'collar', width: 16 },
      { header: 'Estado', key: 'status', width: 14 },
      { header: 'Fecha Alta', key: 'createdAt', width: 16 },
    ];
    animals.forEach((a) => {
      sheet.addRow({
        tag: a.tag ?? `(${a.id.slice(0, 8)})`,
        type: a.animalType?.name ?? '',
        breed: a.breed,
        weight: a.weightKg,
        zone: a.zone?.name ?? 'Sin asignar',
        collar: a.animalCollars[0]?.collar.identifier ?? 'Sin collar',
        status: a.status,
        createdAt: a.createdAt.toLocaleDateString(),
      });
    });
    sheet.getRow(1).font = { bold: true };

    return this.finalizeExcel(workbook);
  }

  // ---------------------------------------------------------------------
  // 3. Lecturas biométricas por rango de fechas (Excel)
  // ---------------------------------------------------------------------
  async farmTelemetryExcel(farmId: string, userId: string, range: DateRange): Promise<Buffer> {
    await this.getOwnedFarm(farmId, userId);

    const animals = await this.prisma.animal.findMany({
      where: { farmId },
      select: {
        tag: true,
        animalCollars: { where: { endAt: null }, select: { collarId: true } },
      },
    });
    const collarToTag = new Map<number, string>();
    animals.forEach((a) => a.animalCollars.forEach((ac) => collarToTag.set(ac.collarId, a.tag ?? '(sin tag)')));
    const collarIds = [...collarToTag.keys()];

    const readings =
      collarIds.length === 0
        ? []
        : await this.prisma.telemetryReading.findMany({
            where: { collarId: { in: collarIds }, timestamp: this.dateFilter(range) },
            orderBy: { timestamp: 'desc' },
          });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Lecturas Biométricas');
    sheet.columns = [
      { header: 'Animal', key: 'animal', width: 18 },
      { header: 'Collar', key: 'collar', width: 10 },
      { header: 'Latitud', key: 'lat', width: 14 },
      { header: 'Longitud', key: 'lng', width: 14 },
      { header: 'Temperatura (°C)', key: 'temp', width: 16 },
      { header: 'Fecha/Hora', key: 'timestamp', width: 20 },
    ];
    readings.forEach((r) => {
      sheet.addRow({
        animal: collarToTag.get(r.collarId) ?? '',
        collar: r.collarId,
        lat: r.latitude,
        lng: r.longitude,
        temp: r.temperature,
        timestamp: r.timestamp.toLocaleString(),
      });
    });
    sheet.getRow(1).font = { bold: true };

    return this.finalizeExcel(workbook);
  }

  // ---------------------------------------------------------------------
  // 4. Eventos de escape de cerco virtual (PDF)
  // ---------------------------------------------------------------------
  async farmEscapesPdf(farmId: string, userId: string, range: DateRange): Promise<Buffer> {
    await this.getOwnedFarm(farmId, userId);
    const escapes = await this.prisma.alert.findMany({
      where: { type: 'ESCAPE', createdAt: this.dateFilter(range), animal: { farmId } },
      include: { animal: true },
      orderBy: { createdAt: 'desc' },
    });

    const doc = new PDFDocument({ margin: 50 });
    doc.fontSize(18).text('Reporte de Escapes de Cerco Virtual');
    doc.fontSize(10).fillColor('#666').text(`Generado: ${new Date().toLocaleString()}`);
    doc.moveDown(1);
    doc.fillColor('#000');

    if (escapes.length === 0) {
      doc.fontSize(12).text('No se registraron escapes en el período seleccionado.');
    } else {
      escapes.forEach((e) => {
        doc.fontSize(11).text(`${new Date(e.createdAt).toLocaleString()} — ${e.animal.tag ?? e.animal.id.slice(0, 8)}`);
        doc.fontSize(10).fillColor('#333').text(e.message);
        doc
          .fontSize(9)
          .fillColor(e.isResolved ? '#16a34a' : '#dc2626')
          .text(e.isResolved ? 'Resuelta' : 'Sin resolver');
        doc.fillColor('#000').moveDown(0.6);
      });
    }

    return this.finalizePdf(doc);
  }

  // ---------------------------------------------------------------------
  // 5. Historial de alertas (PDF o Excel)
  // ---------------------------------------------------------------------
  async farmAlertsReport(farmId: string, userId: string, format: 'pdf' | 'xlsx', range: DateRange): Promise<Buffer> {
    await this.getOwnedFarm(farmId, userId);
    const alerts = await this.prisma.alert.findMany({
      where: { createdAt: this.dateFilter(range), animal: { farmId } },
      include: { animal: true },
      orderBy: { createdAt: 'desc' },
    });

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Alertas');
      sheet.columns = [
        { header: 'Fecha', key: 'date', width: 20 },
        { header: 'Animal', key: 'animal', width: 18 },
        { header: 'Tipo', key: 'type', width: 12 },
        { header: 'Mensaje', key: 'message', width: 50 },
        { header: 'Estado', key: 'status', width: 14 },
      ];
      alerts.forEach((a) => {
        sheet.addRow({
          date: a.createdAt.toLocaleString(),
          animal: a.animal.tag ?? a.animal.id.slice(0, 8),
          type: a.type,
          message: a.message,
          status: a.isResolved ? 'Resuelta' : 'Sin resolver',
        });
      });
      sheet.getRow(1).font = { bold: true };
      return this.finalizeExcel(workbook);
    }

    const doc = new PDFDocument({ margin: 50 });
    doc.fontSize(18).text('Historial de Alertas');
    doc.fontSize(10).fillColor('#666').text(`Generado: ${new Date().toLocaleString()}`);
    doc.moveDown(1);
    doc.fillColor('#000');

    if (alerts.length === 0) {
      doc.fontSize(12).text('No hay alertas en el período seleccionado.');
    } else {
      alerts.forEach((a) => {
        doc
          .fontSize(11)
          .text(`${new Date(a.createdAt).toLocaleString()} — [${a.type}] ${a.animal.tag ?? a.animal.id.slice(0, 8)}`);
        doc.fontSize(10).fillColor('#333').text(a.message);
        doc
          .fontSize(9)
          .fillColor(a.isResolved ? '#16a34a' : '#dc2626')
          .text(a.isResolved ? 'Resuelta' : 'Sin resolver');
        doc.fillColor('#000').moveDown(0.6);
      });
    }

    return this.finalizePdf(doc);
  }

  // ---------------------------------------------------------------------
  // 6. Resumen del rodeo (PDF)
  // ---------------------------------------------------------------------
  async farmSummaryPdf(farmId: string, userId: string): Promise<Buffer> {
    const farm = await this.getOwnedFarm(farmId, userId);

    const [totalAnimals, assignedCollars, totalZones, activeGeofences, unresolvedAlerts] = await Promise.all([
      this.prisma.animal.count({ where: { farmId, isArchived: false } }),
      this.prisma.animalCollar.count({ where: { endAt: null, animal: { farmId } } }),
      this.prisma.zone.count({ where: { farmId } }),
      this.prisma.geofence.count({ where: { active: true, zone: { farmId } } }),
      this.prisma.alert.count({ where: { isResolved: false, animal: { farmId } } }),
    ]);

    const doc = new PDFDocument({ margin: 50 });
    doc.fontSize(18).text(`Resumen del Rodeo — ${farm.name ?? 'Establecimiento'}`);
    doc.fontSize(10).fillColor('#666').text(`Generado: ${new Date().toLocaleString()}`);
    doc.moveDown(1.5);
    doc.fillColor('#000').fontSize(13);
    doc.text(`Total de animales activos: ${totalAnimals}`);
    doc.moveDown(0.4);
    doc.text(`Collares actualmente asignados: ${assignedCollars}`);
    doc.moveDown(0.4);
    doc.text(`Zonas del establecimiento: ${totalZones}`);
    doc.moveDown(0.4);
    doc.text(`Cercos virtuales activos: ${activeGeofences}`);
    doc.moveDown(0.4);
    doc.text(`Alertas sin resolver: ${unresolvedAlerts}`);

    return this.finalizePdf(doc);
  }

  // ---------------------------------------------------------------------
  // 7. Dashboard de KPIs y gráficos para la pantalla de Reportes (JSON)
  // ---------------------------------------------------------------------
  async farmDashboard(farmId: string, userId: string) {
    await this.getOwnedFarm(farmId, userId);

    const [totalAnimals, assignedCollars, totalZones, activeGeofences, unresolvedAlerts, alertsByType] =
      await Promise.all([
        this.prisma.animal.count({ where: { farmId, isArchived: false } }),
        this.prisma.animalCollar.count({ where: { endAt: null, animal: { farmId } } }),
        this.prisma.zone.count({ where: { farmId } }),
        this.prisma.geofence.count({ where: { active: true, zone: { farmId } } }),
        this.prisma.alert.count({ where: { isResolved: false, animal: { farmId } } }),
        this.prisma.alert.groupBy({ by: ['type'], where: { animal: { farmId } }, _count: { _all: true } }),
      ]);

    // Últimos 14 días, del más viejo al más nuevo, con los días sin alertas en 0
    // (para que el gráfico no salte fechas).
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 13);

    const recentAlerts = await this.prisma.alert.findMany({
      where: { animal: { farmId }, createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const dayBuckets = new Map<string, number>();
    for (let i = 0; i < 14; i++) {
      const day = new Date(since);
      day.setDate(day.getDate() + i);
      dayBuckets.set(day.toISOString().slice(0, 10), 0);
    }
    recentAlerts.forEach((alert) => {
      const key = alert.createdAt.toISOString().slice(0, 10);
      dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1);
    });

    return {
      totalAnimals,
      assignedCollars,
      totalZones,
      activeGeofences,
      unresolvedAlerts,
      alertsByType: alertsByType.map((a) => ({ type: a.type, count: a._count._all })),
      alertsByDay: Array.from(dayBuckets.entries()).map(([date, count]) => ({ date, count })),
    };
  }

  // ---------------------------------------------------------------------

  parseFormat(format?: string): 'pdf' | 'xlsx' {
    if (format === 'xlsx') return 'xlsx';
    if (format === undefined || format === 'pdf') return 'pdf';
    throw new BadRequestException('format debe ser "pdf" o "xlsx"');
  }

  private finalizePdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }

  private async finalizeExcel(workbook: ExcelJS.Workbook): Promise<Buffer> {
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
