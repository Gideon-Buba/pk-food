import * as fs from 'fs';
import * as path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

cloudinary.config({
  cloud_name: process.env['CLOUDINARY_CLOUD_NAME'],
  api_key:    process.env['CLOUDINARY_API_KEY'],
  api_secret: process.env['CLOUDINARY_API_SECRET'],
});

const IMAGES_DIR = '/Users/user/Downloads/Food pictures 2';
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

async function uploadFile(filePath: string, fileName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ext = path.extname(fileName).toLowerCase();
    const baseName = path.basename(fileName, ext);
    const publicId = `pk-food/menu/${baseName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;

    cloudinary.uploader.upload(
      filePath,
      { public_id: publicId, resource_type: 'image', overwrite: true },
      (error, result) => {
        if (error || !result) reject(error ?? new Error('Upload failed'));
        else resolve(result.secure_url);
      },
    );
  });
}

async function main(): Promise<void> {
  const files = fs.readdirSync(IMAGES_DIR).filter(f =>
    ALLOWED_EXT.includes(path.extname(f).toLowerCase()),
  );

  if (files.length === 0) {
    console.log('No image files found in', IMAGES_DIR);
    return;
  }

  console.log(`Found ${files.length} images. Uploading...\n`);

  const results: Record<string, string> = {};

  for (const file of files) {
    const filePath = path.join(IMAGES_DIR, file);
    try {
      const url = await uploadFile(filePath, file);
      results[file] = url;
      console.log(`OK  ${file}\n    => ${url}\n`);
    } catch (err) {
      console.error(`ERR ${file}:`, err);
    }
  }

  console.log('\n=== SUMMARY (copy these URLs into DB) ===');
  for (const [name, url] of Object.entries(results)) {
    console.log(`${name}: ${url}`);
  }
}

main().catch(console.error);
