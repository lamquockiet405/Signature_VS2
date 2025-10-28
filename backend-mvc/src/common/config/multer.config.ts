import * as multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

type MulterFile = Express.Multer.File;
type FileFilterCallback = (error: Error | null, acceptFile: boolean) => void;

export const fileFilter = (
  _req: unknown,
  file: MulterFile,
  cb: FileFilterCallback,
): void => {
  const allowedTypes = /pdf|doc|docx|png|jpg|jpeg|txt|xlsx|xls/;
  const extnameOk = allowedTypes.test(
    path.extname(file.originalname || '').toLowerCase(),
  );
  const mimetypeOk = allowedTypes.test(file.mimetype || '');

  if (extnameOk && mimetypeOk) {
    cb(null, true);
    return;
  }
  cb(
    new Error(
      'Invalid file type. Only PDF, DOC, DOCX, PNG, JPG, JPEG, TXT, XLSX, XLS are allowed.',
    ),
    false,
  );
};

export const multerConfig = {
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
  },
  fileFilter: fileFilter,
};
