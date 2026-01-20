/**
 * Print History Component
 * Manages a circular buffer of print jobs with a maximum size
 * Requirements: 5.2, 5.3, 5.4, 5.5
 */
import { v4 as uuidv4 } from 'uuid';
/**
 * PrintHistory class
 * Stores and retrieves print job history using a circular buffer
 */
export class PrintHistory {
    jobs;
    maxSize;
    /**
     * Creates a new PrintHistory instance
     * @param maxSize - Maximum number of jobs to store (default: 1000)
     *
     * Requirements: 5.5
     */
    constructor(maxSize = 1000) {
        this.jobs = [];
        this.maxSize = maxSize;
    }
    /**
     * Adds a new print job to the history
     * If the history is at max capacity, removes the oldest job (circular buffer)
     * @param job - Print job data (without id and timestamp, which are auto-generated)
     * @returns The complete PrintJob with generated id and timestamp
     *
     * Requirements: 5.2, 5.5
     */
    add(job) {
        const completeJob = {
            id: uuidv4(),
            timestamp: new Date(),
            ...job
        };
        // Add to the end of the array
        this.jobs.push(completeJob);
        // If we exceed max size, remove the oldest job (from the beginning)
        if (this.jobs.length > this.maxSize) {
            this.jobs.shift();
        }
        return completeJob;
    }
    /**
     * Retrieves recent print jobs
     * @param limit - Maximum number of jobs to return (default: 50)
     * @returns Array of recent print jobs, newest first
     *
     * Requirements: 5.2, 5.3, 5.4
     */
    getRecent(limit = 50) {
        // Ensure limit doesn't exceed available jobs
        const actualLimit = Math.min(limit, this.jobs.length);
        // Return the most recent jobs (from the end of the array)
        // Slice creates a copy, so external modifications don't affect internal state
        return this.jobs
            .slice(-actualLimit)
            .reverse(); // Newest first
    }
    /**
     * Returns the total number of jobs in the history
     * @returns Number of jobs currently stored
     *
     * Requirements: 5.2
     */
    getCount() {
        return this.jobs.length;
    }
    /**
     * Clears all jobs from the history
     *
     * Requirements: 5.2
     */
    clear() {
        this.jobs = [];
    }
    /**
     * Gets the maximum size of the history buffer
     * @returns Maximum number of jobs that can be stored
     */
    getMaxSize() {
        return this.maxSize;
    }
}
