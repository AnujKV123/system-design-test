// Original UserService with multiple issues for code review
// This is the exact code provided in the assessment

export class UserService {
  private users: any[] = [];

  async getUser(id: string) {
    const response = await fetch(`/api/users/${id}`);
    const data = await response.json();
    return data;
  }

  async createUser(userData: any) {
    const user = {
      id: Math.random().toString(),
      ...userData,
      createdAt: new Date()
    };
    this.users.push(user);
    return user;
  }

  async updateUser(id: string, updates: any) {
    const user = this.users.find(u => u.id === id);
    if (user) {
      Object.assign(user, updates);
      return user;
    }
    return null;
  }

  getAllUsers() {
    return this.users;
  }
}
