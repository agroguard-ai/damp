import { Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * @deprecated Use JwtAuthGuard instead. ClerkAuthGuard is maintained as an alias for compatibility.
 */
@Injectable()
export class ClerkAuthGuard extends JwtAuthGuard {}
