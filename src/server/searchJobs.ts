import { randomUUID } from "node:crypto";
import type { SearchRunResult } from "../types.js";

export type SearchJobStatus = "queued" | "running" | "completed" | "failed";

export interface SearchJob {
  id: string;
  query: string;
  status: SearchJobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  result?: SearchRunResult;
}

type SearchJobWorker = (query: string, body: Record<string, unknown>) => Promise<SearchRunResult>;

export class SearchJobQueue {
  private readonly jobs = new Map<string, SearchJob>();
  private readonly queue: Array<{ id: string; body: Record<string, unknown> }> = [];
  private running = false;

  constructor(
    private readonly worker: SearchJobWorker,
    private readonly maxJobs = 50
  ) {}

  enqueue(query: string, body: Record<string, unknown>): SearchJob {
    const now = new Date().toISOString();
    const job: SearchJob = {
      id: randomUUID(),
      query,
      status: "queued",
      createdAt: now,
      updatedAt: now
    };

    this.jobs.set(job.id, job);
    this.queue.push({ id: job.id, body });
    this.trimCompletedJobs();
    void this.processNext();
    return job;
  }

  get(id: string): SearchJob | undefined {
    return this.jobs.get(id);
  }

  private async processNext(): Promise<void> {
    if (this.running) {
      return;
    }

    const next = this.queue.shift();

    if (!next) {
      return;
    }

    const job = this.jobs.get(next.id);

    if (!job) {
      void this.processNext();
      return;
    }

    this.running = true;
    job.status = "running";
    job.startedAt = new Date().toISOString();
    job.updatedAt = job.startedAt;

    try {
      job.result = await this.worker(job.query, next.body);
      job.status = "completed";
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "search failed";
    } finally {
      job.finishedAt = new Date().toISOString();
      job.updatedAt = job.finishedAt;
      this.running = false;
      void this.processNext();
    }
  }

  private trimCompletedJobs(): void {
    if (this.jobs.size <= this.maxJobs) {
      return;
    }

    const removable = [...this.jobs.values()]
      .filter((job) => job.status === "completed" || job.status === "failed")
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    for (const job of removable) {
      if (this.jobs.size <= this.maxJobs) {
        return;
      }

      this.jobs.delete(job.id);
    }
  }
}
