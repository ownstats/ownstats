import { createReadStream } from 'fs';
import { createHash } from 'crypto';

export default class FileHasher {
  constructor(filePath) {
    this.filePath = filePath;
  }

  getHash(algorithm = 'sha1') {
    return new Promise((resolve, reject) => {
      // Another algorithms: 'sha1', 'md5', 'sha256', 'sha512' ...
      let shasum = createHash(algorithm);
      try {
        let s = createReadStream(this.filePath);
        s.on('data', function(data) {
          shasum.update(data);
        });
        // making digest
        s.on('end', function() {
          const hash = shasum.digest('hex');
          return resolve(hash);
        });
      } catch (error) {
        return reject('File hash generation failed');
      }
    });
  }
} 