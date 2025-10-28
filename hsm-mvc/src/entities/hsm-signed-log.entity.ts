import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('hsm_signedlogs')
export class HsmSignedLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid' })
  key_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid', nullable: true })
  document_id: string;

  @Column({ type: 'varchar', length: 255 })
  data_hash: string;

  @Column({ type: 'text' })
  signature: string;

  @Column({ type: 'varchar', length: 100 })
  signature_algorithm: string;

  @Column({ type: 'varchar', length: 50 })
  hash_algorithm: string;

  @Column({ type: 'varchar', length: 20, default: 'success' })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn()
  created_at: Date;
}
