import { PartialType } from '@nestjs/mapped-types';
import { CreateGroupDto } from './create-group.dto';

// Tous les champs de création deviennent optionnels.
export class UpdateGroupDto extends PartialType(CreateGroupDto) {}
