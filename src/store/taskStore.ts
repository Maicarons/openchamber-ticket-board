import type { HostClient, JsonValue } from '@openchamber/sdk';
import { parseTask, type Task } from '../domain/task.ts';

type Storage = Pick<HostClient, 'storage'>;

export const TASK_KEY_PREFIX = 'task:';
const READ_BATCH = 16;

export const taskKey = (id: string) => `${TASK_KEY_PREFIX}${id}`;

export type LoadResult = { tasks: Task[]; failedKeys: string[] };

/** One record per task, so editing one task can never clobber another. */
export const loadTasks = async (host: Storage): Promise<LoadResult> => {
  const keys = (await host.storage.keys()).filter((key) => key.startsWith(TASK_KEY_PREFIX));
  const tasks: Task[] = [];
  const failedKeys: string[] = [];
  for (let offset = 0; offset < keys.length; offset += READ_BATCH) {
    await Promise.all(keys.slice(offset, offset + READ_BATCH).map(async (key) => {
      try {
        const task = parseTask(await host.storage.get(key));
        if (taskKey(task.id) !== key) throw new Error('Task id does not match its key');
        tasks.push(task);
      } catch {
        failedKeys.push(key);
      }
    }));
  }
  return { tasks, failedKeys };
};

export const saveTask = async (host: Storage, task: Task) => {
  const checked = parseTask(task);
  await host.storage.set(taskKey(checked.id), checked as unknown as JsonValue);
};

export const deleteTask = (host: Storage, id: string) => host.storage.delete(taskKey(id));
