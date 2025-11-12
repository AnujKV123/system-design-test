import { TransformFn, PipelineResult, FailedRecord } from './types';

/**
 * Internal representation of a transformation step
 */
interface TransformStep<TInput, TOutput> {
  fn: TransformFn<TInput, TOutput>;
  name: string;
}

/**
 * A composable data transformation pipeline with type-safe transformations
 * and partial failure handling.
 * 
 * @template TInput - The input type for the pipeline
 * @template TOutput - The output type after all transformations
 */
export class Pipeline<TInput, TOutput> {
  private steps: TransformStep<any, any>[] = [];

  /**
   * Creates a new Pipeline instance
   * 
   * @param steps - Optional initial transformation steps
   */
  constructor(steps: TransformStep<any, any>[] = []) {
    this.steps = steps;
  }

  /**
   * Adds a transformation step to the pipeline and returns a new Pipeline
   * with updated type parameters.
   * 
   * @template TNext - The output type of the new transformation
   * @param fn - The transformation function to apply
   * @param name - Optional name for the transformation step (for error reporting)
   * @returns A new Pipeline instance with the added transformation
   */
  transform<TNext>(
    fn: TransformFn<TOutput, TNext>,
    name?: string
  ): Pipeline<TInput, TNext> {
    const stepName = name || fn.name || `step-${this.steps.length + 1}`;
    const newSteps = [...this.steps, { fn, name: stepName }];
    return new Pipeline<TInput, TNext>(newSteps);
  }

  /**
   * Executes the pipeline on an array of input data, processing each record
   * through all transformation steps. Failures are isolated per record.
   * 
   * @param data - Array of input data to process
   * @returns PipelineResult containing successful and failed records with counts
   */
  async execute(data: TInput[]): Promise<PipelineResult<TOutput>> {
    const successful: TOutput[] = [];
    const failed: FailedRecord[] = [];

    for (const record of data) {
      let current: any = record;
      let failedStepName: string | null = null;

      try {
        // Apply each transformation step sequentially
        // Wrap each step in try-catch to track which step failed
        for (const step of this.steps) {
          try {
            current = await step.fn(current);
          } catch (error) {
            failedStepName = step.name;
            throw error;
          }
        }
        
        // All steps succeeded
        successful.push(current as TOutput);
      } catch (error) {
        // Isolate failures - one record's failure doesn't stop processing of other records
        failed.push({
          originalData: record,
          error: error instanceof Error ? error : new Error(String(error)),
          step: failedStepName || 'unknown'
        });
      }
    }

    return {
      successful,
      failed,
      successCount: successful.length,
      failureCount: failed.length,
      totalCount: data.length
    };
  }
}
