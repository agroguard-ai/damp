import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@generated/prisma';

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientUnknownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientUnknownRequestError,
    host: ArgumentsHost
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error en la base de datos';
    let error = 'Database Error';

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2003': {
          // Foreign key constraint failed / RESTRICT violation
          statusCode = HttpStatus.CONFLICT;
          error = 'Conflict';
          const field = (exception.meta?.field_name as string) || '';
          message = field
            ? `No se puede completar la operación debido a una restricción de integridad referencial (${field}). El registro posee historial o dependencias asociadas. Te sugerimos archivarlo o darlo de baja.`
            : 'No se puede eliminar o modificar el registro porque tiene datos históricos o dependencias asociadas (restricción de clave foránea). Te sugerimos archivarlo o darlo de baja.';
          break;
        }
        case 'P2002': {
          statusCode = HttpStatus.CONFLICT;
          error = 'Conflict';
          const target = Array.isArray(exception.meta?.target)
            ? (exception.meta.target as string[]).join(', ')
            : (exception.meta?.target as string) || 'campo único';
          message = `Ya existe un registro con el mismo valor para: ${target}`;
          break;
        }
        case 'P2025': {
          statusCode = HttpStatus.NOT_FOUND;
          error = 'Not Found';
          message = (exception.meta?.cause as string) || 'El registro solicitado no fue encontrado';
          break;
        }
        default: {
          this.logger.error(`Prisma unhandled code [${exception.code}]: ${exception.message}`);
          message = exception.message;
          break;
        }
      }
    } else {
      // Unknown request error - check message for RESTRICT / Foreign key violation
      const msg = exception.message || '';
      if (msg.includes('violates RESTRICT setting of foreign key constraint') || msg.includes('violates foreign key constraint') || msg.includes('23001')) {
        statusCode = HttpStatus.CONFLICT;
        error = 'Conflict';
        message = 'No se puede eliminar el registro porque tiene datos históricos asociados (restricción RESTRICT). Te recomendamos archivarlo o darlo de baja en su lugar.';
      } else {
        this.logger.error(`Prisma unknown error: ${msg}`);
      }
    }

    response.status(statusCode).json({
      statusCode,
      error,
      message,
    });
  }
}
