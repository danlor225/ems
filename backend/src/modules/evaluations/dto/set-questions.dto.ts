import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsUUID,
} from 'class-validator';

export class SetQuestionsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins une question.' })
  @ArrayMaxSize(60, { message: 'Au plus 60 questions.' })
  @IsUUID(undefined, { each: true })
  questionIds: string[];
}
