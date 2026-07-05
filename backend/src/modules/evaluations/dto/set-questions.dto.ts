import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsUUID,
} from 'class-validator';

export class SetQuestionsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins une question.' })
  @ArrayMaxSize(20, { message: 'Au plus 20 questions.' })
  @IsUUID(undefined, { each: true })
  questionIds: string[];
}
