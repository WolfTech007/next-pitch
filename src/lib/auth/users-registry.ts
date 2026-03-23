import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type AuthUser = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

type RegistryFile = {
  users: AuthUser[];
};

function registryPath(): string {
  return path.join(process.cwd(), "data", "auth-users.json");
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(path.dirname(registryPath()), { recursive: true });
}

export async function readRegistry(): Promise<AuthUser[]> {
  try {
    const raw = await fs.readFile(registryPath(), "utf8");
    const j = JSON.parse(raw) as RegistryFile;
    return Array.isArray(j.users) ? j.users : [];
  } catch {
    return [];
  }
}

export async function writeRegistry(users: AuthUser[]): Promise<void> {
  await ensureDir();
  const body: RegistryFile = { users };
  await fs.writeFile(registryPath(), JSON.stringify(body, null, 2), "utf8");
}

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const normalized = email.trim().toLowerCase();
  const users = await readRegistry();
  return users.find((u) => u.email === normalized) ?? null;
}

export async function findUserById(id: string): Promise<AuthUser | null> {
  const users = await readRegistry();
  return users.find((u) => u.id === id) ?? null;
}

export async function createUser(email: string, passwordHash: string): Promise<AuthUser> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) {
    throw new Error("Invalid email.");
  }
  const users = await readRegistry();
  if (users.some((u) => u.email === normalized)) {
    throw new Error("An account with this email already exists.");
  }
  const user: AuthUser = {
    id: randomUUID(),
    email: normalized,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await writeRegistry(users);
  return user;
}
