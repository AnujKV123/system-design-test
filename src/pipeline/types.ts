// Core types for the data transformation pipeline

/**
 * Function type for transformation steps in the pipeline
 */
export type TransformFn<TInput, TOutput> = (
  input: TInput
) => TOutput | Promise<TOutput>;

/**
 * Represents a failed record in the pipeline execution
 */
export interface FailedRecord {
  /** The original data that failed to transform */
  originalData: unknown;
  /** The error that occurred during transformation */
  error: Error;
  /** The step name where the failure occurred */
  step: string;
}

/**
 * Result of pipeline execution containing successful and failed records
 */
export interface PipelineResult<T> {
  /** Array of successfully transformed records */
  successful: T[];
  /** Array of failed records with error context */
  failed: FailedRecord[];
  /** Count of successful transformations */
  successCount: number;
  /** Count of failed transformations */
  failureCount: number;
  /** Total count of input records */
  totalCount: number;
}
