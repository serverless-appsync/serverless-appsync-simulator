import fs from 'fs';
import path from 'path';
import globby from 'globby';
import { DEFAULT_ENCODING } from './constants';

function toAbsolutePosixPath(basePath: string, filePath: string): string {
  return (
    path.isAbsolute(filePath) ? filePath : path.join(basePath, filePath)
  ).replace(/\\/g, '/');
}

export function globFilePaths(basePath: string, filePaths: string[]) {
  return filePaths
    .map((filePath) => {
      const paths = globby.sync(toAbsolutePosixPath(basePath, filePath));
      if (path.isAbsolute(filePath)) {
        return paths;
      } else {
        // For backward compatibility with FileMap, revert to relative path
        return paths.map((p) => path.relative(basePath, p));
      }
    })
    .flat();
}

export function getFileMap(basePath: string, filePath: string) {
  return {
    path: filePath,
    content: fs.readFileSync(toAbsolutePosixPath(basePath, filePath), {
      encoding: DEFAULT_ENCODING,
    }),
  };
}
