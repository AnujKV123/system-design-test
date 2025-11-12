import { randomUUID } from 'crypto';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CreateUserDto {
  name: string;
  email: string;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
}

export interface UserRepository {
  create(user: User): Promise<User>;
  findById(id: string): Promise<User | null>;
  update(id: string, updates: Partial<User>): Promise<User | null>;
  delete(id: string): Promise<boolean>;
  findAll(): Promise<User[]>;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async createUser(userData: CreateUserDto): Promise<User> {
    try {
      this.validateUserData(userData);

      const user: User = {
        id: randomUUID(),
        name: userData.name.trim(),
        email: userData.email.toLowerCase().trim(),
        createdAt: new Date(),
      };

      return await this.userRepository.create(user);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError(
        `Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getUserById(id: string): Promise<User> {
    try {
      const user = await this.userRepository.findById(id);

      if (!user) {
        throw new NotFoundError(`User with id ${id} not found`);
      }

      return user;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError(
        `Failed to fetch user: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async updateUser(id: string, updates: UpdateUserDto): Promise<User> {
    try {
      this.validateUpdateData(updates);

      const existingUser = await this.userRepository.findById(id);

      if (!existingUser) {
        throw new NotFoundError(`User with id ${id} not found`);
      }

      const sanitizedUpdates: Partial<User> = {};
      if (updates.name !== undefined) {
        sanitizedUpdates.name = updates.name.trim();
      }
      if (updates.email !== undefined) {
        sanitizedUpdates.email = updates.email.toLowerCase().trim();
      }

      const updatedUser: User = {
        ...existingUser,
        ...sanitizedUpdates,
        updatedAt: new Date(),
      };

      const result = await this.userRepository.update(id, updatedUser);

      if (!result) {
        throw new DatabaseError('Failed to update user');
      }

      return result;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError(
        `Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findById(id);

      if (!user) {
        throw new NotFoundError(`User with id ${id} not found`);
      }

      return await this.userRepository.delete(id);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError(
        `Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return await this.userRepository.findAll();
    } catch (error) {
      throw new DatabaseError(
        `Failed to fetch users: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async fetchUserFromApi(userId: string, timeoutMs = 5000): Promise<User> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`https://api.example.com/users/${userId}`, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new HttpError(
          response.status,
          `Failed to fetch user: ${response.statusText}`
        );
      }

      const data = await response.json();
      return data as User;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(`Request timed out after ${timeoutMs}ms`);
      }

      if (error instanceof HttpError) {
        throw error;
      }

      throw new NetworkError(
        `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private validateUserData(userData: CreateUserDto): void {
    if (!userData.name || userData.name.trim().length === 0) {
      throw new ValidationError('Name is required and cannot be empty');
    }

    if (userData.name.trim().length < 2) {
      throw new ValidationError('Name must be at least 2 characters long');
    }

    if (userData.name.trim().length > 100) {
      throw new ValidationError('Name must not exceed 100 characters');
    }

    if (!userData.email || userData.email.trim().length === 0) {
      throw new ValidationError('Email is required and cannot be empty');
    }

    if (!this.isValidEmail(userData.email)) {
      throw new ValidationError('Email format is invalid');
    }
  }

  private validateUpdateData(updates: UpdateUserDto): void {
    if (Object.keys(updates).length === 0) {
      throw new ValidationError('At least one field must be provided for update');
    }

    if (updates.name !== undefined) {
      if (updates.name.trim().length === 0) {
        throw new ValidationError('Name cannot be empty');
      }

      if (updates.name.trim().length < 2) {
        throw new ValidationError('Name must be at least 2 characters long');
      }

      if (updates.name.trim().length > 100) {
        throw new ValidationError('Name must not exceed 100 characters');
      }
    }

    if (updates.email !== undefined) {
      if (updates.email.trim().length === 0) {
        throw new ValidationError('Email cannot be empty');
      }

      if (!this.isValidEmail(updates.email)) {
        throw new ValidationError('Email format is invalid');
      }
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }
}

export class InMemoryUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();

  async create(user: User): Promise<User> {
    this.users.set(user.id, { ...user });
    return { ...user };
  }

  async findById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      return null;
    }

    const updatedUser = { ...existingUser, ...updates };
    this.users.set(id, updatedUser);
    return { ...updatedUser };
  }

  async delete(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async findAll(): Promise<User[]> {
    return Array.from(this.users.values()).map(user => ({ ...user }));
  }
}
