// Original UserService with multiple issues for code review

export class UserService {
  private users: any[] = [];

  async createUser(userData: any) {
    const user = {
      id: Math.random().toString(36).substr(2, 9),
      ...userData,
      createdAt: new Date()
    };
    
    this.users.push(user);
    return user;
  }

  async getUserById(id: string) {
    const user = this.users.find(u => u.id === id);
    return user || null;
  }

  async updateUser(id: string, updates: any) {
    const user = this.users.find(u => u.id === id);
    
    if (!user) {
      return null;
    }
    
    Object.assign(user, updates);
    return user;
  }

  async deleteUser(id: string) {
    const index = this.users.findIndex(u => u.id === id);
    
    if (index === -1) {
      return null;
    }
    
    this.users.splice(index, 1);
    return true;
  }

  async getAllUsers() {
    return this.users;
  }

  async fetchUserFromApi(userId: string) {
    const response = await fetch(`https://api.example.com/users/${userId}`);
    const data = await response.json();
    return data;
  }
}
