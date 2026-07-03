import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '../config/config.service';

@Injectable()
export class UploadsService {
  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.cloudinaryCloudName,
      api_key:    this.config.cloudinaryApiKey,
      api_secret: this.config.cloudinaryApiSecret,
    });
  }

  async uploadImage(buffer: Buffer, originalName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const publicId = `pk-food/menu/${Date.now()}-${originalName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/gi, '-')}`;

      cloudinary.uploader.upload_stream(
        { public_id: publicId, resource_type: 'image', overwrite: false },
        (error, result) => {
          if (error || !result) {
            reject(new InternalServerErrorException('Image upload failed'));
          } else {
            resolve(result.secure_url);
          }
        },
      ).end(buffer);
    });
  }
}
