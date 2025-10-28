import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Exclude } from 'class-transformer';
import { HsmSlot } from './hsm-slot.entity';

@Entity('hsm_keys')
export class HsmKey {
  @PrimaryColumn('uuid')
  key_id: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string;

  @Column({ type: 'varchar', length: 50 })
  key_type: string;

  @Column({ type: 'integer' })
  key_size: number;

  @Column({ type: 'varchar', length: 100 })
  algorithm: string;

  @Column({ type: 'text' })
  public_key: string;

  @Column({ type: 'text', nullable: true })
  @Exclude()
  private_key: string;

  @Column({ type: 'varchar', length: 255 })
  key_label: string;

  @Column({ type: 'varchar', length: 255 })
  key_usage: string;

  @Column({ type: 'integer' })
  slot_id: number;

  @Column({ type: 'varchar', length: 100 })
  token_label: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @Column({ type: 'varchar', length: 255, nullable: true })
  private_key_handle: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date;

  @ManyToOne(() => HsmSlot)
  @JoinColumn({ name: 'slot_id' })
  slot: HsmSlot;
}
