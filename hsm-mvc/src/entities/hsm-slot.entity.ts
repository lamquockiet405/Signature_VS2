import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { HsmKey } from './hsm-key.entity';

@Entity('hsm_slots')
export class HsmSlot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer', unique: true })
  slot_id: number;

  @Column({ type: 'varchar', length: 100 })
  slot_label: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  manufacturer_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  serial_number: string;

  @Column({ type: 'boolean', default: true })
  is_available: boolean;

  @Column({ type: 'integer', default: 0 })
  session_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => HsmKey, key => key.slot)
  keys: HsmKey[];
}
