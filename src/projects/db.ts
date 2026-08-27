import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import type { Project } from '../types';

interface CircuitSpaceDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'modifiedAt': string };
  };
}

const DB_NAME = 'CircuitSpaceDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<CircuitSpaceDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CircuitSpaceDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('projects', { keyPath: 'id' });
        store.createIndex('modifiedAt', 'modifiedAt');
      },
    });
  }
  return dbPromise;
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB();
  const toSave = { ...project, modifiedAt: new Date().toISOString() };
  await db.put('projects', toSave);
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get('projects', id);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('projects', id);
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDB();
  const projects = await db.getAllFromIndex('projects', 'modifiedAt');
  return projects.reverse(); // Newest first
}
