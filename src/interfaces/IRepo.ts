export interface ICrud<T> {
  list(): Promise<T[]>;
  add(item: T): Promise<T>;
  update(id: string | number, data: Partial<T>): Promise<void>;
  remove(id: string | number): Promise<void>;
}

export interface IProfileRepo {
  get(): Promise<any>;
  update(data: any): Promise<void>;
}

export interface IGoalsRepo extends ICrud<any> {
  addSaving?(id: string | number, amount: number): Promise<number>;
}

export interface IRepo {
  transactions: ICrud<any>;
  budgets: ICrud<any>;
  categories: ICrud<any>;
  subscriptions: ICrud<any>;
  goals: IGoalsRepo;
  profile: IProfileRepo;
  challenges: ICrud<any>;
  seedDummy?(): void;
}
