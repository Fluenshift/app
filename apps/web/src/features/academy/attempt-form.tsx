// One Exercise's question, by its public view. Ported from Grifando
// src/components/exercises/ExerciseQuestion.tsx (74dbb9f).
import type { PublicExercise } from "@fluenshift/contract";
import { Input } from "@fluenshift/ui/components/input";
import { Label } from "@fluenshift/ui/components/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@fluenshift/ui/components/radio-group";
import { Textarea } from "@fluenshift/ui/components/textarea";

export const AttemptForm = ({
  answer,
  exercise,
  onAnswerChange,
}: {
  readonly answer: string;
  readonly exercise: PublicExercise;
  readonly onAnswerChange: (value: string) => void;
}) => {
  if (exercise.type === "MULTIPLE_CHOICE") {
    return (
      <div className="space-y-6">
        <p className="text-subheading">{exercise.instruction}</p>
        <RadioGroup
          onValueChange={(value) => {
            onAnswerChange(String(value));
          }}
          value={answer}
        >
          {exercise.options.map((option, index) => (
            <Label
              className="rounded-field bg-card text-foreground ring-border hover:ring-stone has-data-checked:bg-linen has-data-checked:ring-foreground flex cursor-pointer items-center gap-3 px-4 py-3.5 text-base leading-snug ring-1"
              key={option}
            >
              <RadioGroupItem value={String(index)} />
              {option}
            </Label>
          ))}
        </RadioGroup>
      </div>
    );
  }

  if (exercise.type === "FILL_BLANK") {
    return (
      <div className="space-y-6">
        <p className="text-subheading">{exercise.instruction}</p>
        <p className="prose-serif text-2xl leading-snug">{exercise.template}</p>
        <Input
          aria-label="Your answer"
          onChange={(event) => {
            onAnswerChange(event.target.value);
          }}
          placeholder="Your answer"
          value={answer}
        />
      </div>
    );
  }

  if (exercise.type === "REWRITE") {
    return (
      <div className="space-y-6">
        <p className="text-subheading">{exercise.instruction}</p>
        <p className="prose-serif text-2xl leading-snug">
          &ldquo;{exercise.original}&rdquo;
        </p>
        <Textarea
          aria-label="Your rewrite"
          className="prose-serif text-lg"
          onChange={(event) => {
            onAnswerChange(event.target.value);
          }}
          rows={3}
          value={answer}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-subheading">{exercise.instruction}</p>
      <p className="prose-serif text-2xl leading-snug">
        &ldquo;{exercise.sourceText}&rdquo;
      </p>
      <Textarea
        aria-label="Your translation"
        className="prose-serif text-lg"
        onChange={(event) => {
          onAnswerChange(event.target.value);
        }}
        rows={3}
        value={answer}
      />
    </div>
  );
};
