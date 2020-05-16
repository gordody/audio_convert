import commandLineArgs  from 'command-line-args';
import fs from 'fs';
const fsp = fs.promises;

interface FileProcessingResult {
  data: any,
  error: Error | null
}

interface FileProcessor {
  process: (filePath: string, options: any) => Promise<FileProcessingResult>
}

class AudioFileConverter implements FileProcessor {
  process(filePath: string, options: any) {
    return new Promise<FileProcessingResult>((resolve, reject) => {
      resolve({ data: 'success', error: null });
    });
  }
}

interface FolderProcessorOptions {
  verboseLog?: boolean;
  rootFolder: Array<string>, // folders to process, 1 or more
  fileTypes: Array<string>    // file types / extensions to process, 1 or more
  outputType?: string         // output file type
}

class FolderProcessor {
  verboseLog: boolean;
  rootFolder: Array<string>; // folders to process, 1 or more
  fileTypes: Array<string>;   // file types / extensions to process, 1 or more
  outputType: string;        // output file type

  constructor(options: FolderProcessorOptions) {
    this.verboseLog = options.verboseLog || false;
    this.rootFolder = options.rootFolder;
    this.fileTypes = options.fileTypes;
    this.outputType = options.outputType || '.mp3';
  }

  async processFile(filePath: string) {
    console.log(`Processing file ${filePath}`);
  }

  async processFolder(folderPath: string) {
    console.log(`Processing folder ${folderPath}`);
    try {
      const folderContents = await fsp.readdir('folderPath', { withFileTypes: true });
      folderContents.forEach((entry) => {
        if (entry.isDirectory()) this.processFolder(entry.name);
        if (entry.isFile()) this.processFile(entry.name);
      });
    } catch (err) {
      console.error('Error occured while reading directory!', err);
    }
  }

  start() {
    this.rootFolder.forEach((folder) => { this.processFolder(folder); });
  }
}

function main() {
  const optionDefinitions = [
    { name: 'verbose', alias: 'v', type: Boolean },
    { name: 'src', alias: 's', type: String, multiple: true, defaultOption: true },
    { name: 'type', alias: 't', type: String, multiple: true },
    { name: 'outputType', alias: 'o', type: String, multiple: false }
  ];
  const cmdOptions = commandLineArgs(optionDefinitions);

  const rootFolder = (cmdOptions.src && cmdOptions.src.length) ? cmdOptions.src : [__dirname];
  const fileTypes = (cmdOptions.type && cmdOptions.type.length) ? cmdOptions.type : ['mp3'];

  const options = {
    verboseLog: cmdOptions.verbose,
    rootFolder,
    fileTypes,
    outputType: cmdOptions.outputType
  };
  const folderProcessor = new FolderProcessor(options);
  console.log('Starting');
  (async () => await folderProcessor.start())();
  console.log('Done');
}


main();