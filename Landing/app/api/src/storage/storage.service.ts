import { Injectable, Logger } from '@nestjs/common';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { randomUUID } from 'crypto';

/** Everything this app stores in Azure Blob lives under one container. */
const CONTAINER_NAME = 'imlapp';

export interface StoredFile {
  url: string;
  name: string;
  folder: string;
  size: number;
  lastModified: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: BlobServiceClient | null = null;
  private containerReady: Promise<ContainerClient> | null = null;
  private publiclyReadable = false;

  private getClient(): BlobServiceClient {
    if (!this.client) {
      const sasUrl = process.env.BLOB_SERVICE_SAS_URL;
      if (!sasUrl) throw new Error('BLOB_SERVICE_SAS_URL is not configured');
      this.client = new BlobServiceClient(sasUrl);
    }
    return this.client;
  }

  /** Creates the imlapp container on first use and figures out whether its
   *  blobs are publicly readable — cached for the life of the process. */
  private async ensureContainer(): Promise<ContainerClient> {
    if (!this.containerReady) {
      this.containerReady = (async () => {
        const container = this.getClient().getContainerClient(CONTAINER_NAME);
        try {
          await container.createIfNotExists({ access: 'blob' });
        } catch (err) {
          this.logger.warn(
            `Could not request public blob access on container "${CONTAINER_NAME}": ${String(err)}`,
          );
          await container.createIfNotExists();
        }
        try {
          const props = await container.getProperties();
          this.publiclyReadable =
            props.blobPublicAccess === 'blob' || props.blobPublicAccess === 'container';
        } catch {
          this.publiclyReadable = false;
        }
        if (!this.publiclyReadable) {
          this.logger.warn(
            `Container "${CONTAINER_NAME}" is not publicly readable (the storage account likely ` +
              `has "Allow Blob Public Access" disabled). Falling back to SAS-token URLs, which stop ` +
              `working once the token expires — see BLOB_SERVICE_SAS_URL.`,
          );
        }
        return container;
      })();
    }
    return this.containerReady;
  }

  /**
   * The SDK client was constructed from a SAS URL, so every blob's own
   * `.url` getter already has the SAS query string baked in — that's what
   * makes it readable today. When the container turns out to be publicly
   * readable we strip it for a clean, permanent URL; otherwise we keep it
   * as-is (works now, expires with the token — see ensureContainer).
   */
  private urlFor(blobUrl: string): string {
    return this.publiclyReadable ? blobUrl.split('?')[0] : blobUrl;
  }

  private cleanFolder(folder: string | undefined): string {
    return (folder ?? '').replace(/[^a-zA-Z0-9_-]/g, '') || 'misc';
  }

  async upload(
    folder: string,
    originalName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<StoredFile> {
    const container = await this.ensureContainer();
    const ext = originalName.includes('.') ? originalName.split('.').pop() : undefined;
    const safeFolder = this.cleanFolder(folder);
    const blobName = `${safeFolder}/${randomUUID()}${ext ? `.${ext}` : ''}`;
    const blockBlob = container.getBlockBlobClient(blobName);

    await blockBlob.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: contentType },
    });

    return {
      url: this.urlFor(blockBlob.url),
      name: blobName,
      folder: safeFolder,
      size: buffer.length,
      lastModified: new Date().toISOString(),
    };
  }

  /** List previously uploaded files, optionally scoped to one folder — the
   *  data behind the admin's media-library picker. Newest first. */
  async list(folder?: string): Promise<StoredFile[]> {
    const container = await this.ensureContainer();
    const prefix = folder ? `${this.cleanFolder(folder)}/` : undefined;
    const items: StoredFile[] = [];
    for await (const blob of container.listBlobsFlat({ prefix })) {
      const blockBlob = container.getBlockBlobClient(blob.name);
      items.push({
        url: this.urlFor(blockBlob.url),
        name: blob.name,
        folder: blob.name.split('/')[0] ?? '',
        size: blob.properties.contentLength ?? 0,
        lastModified: (blob.properties.lastModified ?? new Date(0)).toISOString(),
      });
    }
    items.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
    return items;
  }
}
