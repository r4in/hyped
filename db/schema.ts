import { integer,sqliteTable,text } from 'drizzle-orm/sqlite-core';
export const wardrobeStates=sqliteTable('wardrobe_states',{userId:text('user_id').primaryKey(),data:text('data').notNull(),revision:integer('revision').notNull().default(0)});
