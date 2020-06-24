import fs from 'fs';
const fsp = fs.promises;
import util from 'util';
const exists = util.promisify(fs.exists);
import path from 'path';
import commandLineArgs  from 'command-line-args';
import trash from 'trash';
import child_process from 'child_process';
const execFile = util.promisify(child_process.execFile);

// any more? 
const AUDIO_FORMATS = [
  '3gp',
  'a52',
  'asf',
  'aac',
  'aif',
  'aiff',
  'au',
  'dts',
  'dv',
  'flac',
  'flv',
  'ogm',
  'ogg',
  'm4a',
  'mp3',
  'mid',
  'mka',
  'mkv',
  'mlp',
  'mod',
  'ts',
  'tac',
  'tta',
  'ty',
  'vid',
  'wmv',
  'xa',
  'wav'
];

const VLC_CMD = {
  win: `${process.env.PROGRAMFILES}\\VideoLAN\\VLC\\vlc.exe`,
  osx: '/Applications/VLC.app/Contents/MacOS/VLC'
}

function getVlcCmdForOs() {
  const platform = process.platform;
  if (platform === 'win32') return VLC_CMD.win;
  if (platform === 'darwin') return VLC_CMD.osx;

  throw Error('Unsupported platform: ' + platform);
}

interface FileProcessingResult {
  resultPath: string,
  error?: Error | null
}

interface FileProcessor {
  process: (filePath: string) => Promise<FileProcessingResult>
}

class AudioFileConverter implements FileProcessor {
  cmd: string;
  outputType: string;
  outputOptions?: string;

  constructor(outputType: string) {
    this.outputType = outputType;
    if (outputType === 'mp3') this.outputOptions = 'acodec=mp3,ab=512,channels=2,samplerate=44100';
    this.cmd = getVlcCmdForOs();
  }

  //  -I dummy -vvv --sout "#transcode{acodec=mp3,ab=512,channels=2,samplerate=44100}:std{access=file,mux=raw,dst=/Users/gyuri/Desktop/audio_test_files/test/Sample_BeeMoved_96kHz24bit.mp3}" /Users/gyuri/Desktop/audio_test_files/test/Sample_BeeMoved_96kHz24bit.flac vlc://quit
  async _processFile(inputFilePath: string, outputFileName: string) {
    const sOutStr = `#transcode{${this.outputOptions}}:std{access=file,mux=raw,dst="${outputFileName}"}`;
    const cmdArgs: Array<string> = [
      '-I', 'dummy', 
      inputFilePath,
      '--sout',
      sOutStr,
      'vlc://quit'
    ];
    return execFile(this.cmd, cmdArgs);
  }

  async process(filePath: string) {

    const filePathObj = path.parse(filePath);
    const fileName = filePathObj.name;
    const dstFileName = `${fileName}.${this.outputType}`;
    filePathObj.ext = '.' + this.outputType;
    filePathObj.base = '';
    const resultPath = path.format(filePathObj); 

    const processRes = await this._processFile(filePath, resultPath);
    // do we need to wait for the process to end?
    const res: FileProcessingResult = { resultPath };

    return res;
  }
}

interface FolderProcessorOptions {
  verboseLog?: boolean;
  rootFolder: Array<string>, // folders to process, 1 or more
  fileTypes: Array<string>    // file types / extensions to process, 1 or more
  outputType?: string         // output file type
  deleteOriginals?: boolean
}

class FolderProcessor {
  verboseLog: boolean;
  rootFolder: Array<string>; // folders to process, 1 or more
  fileTypes: Array<string>;   // file types / extensions to process, 1 or more
  outputType: string;        // output file type
  deleteOriginals: boolean;
  fileProcessor: FileProcessor;

  constructor(options: FolderProcessorOptions) {
    this.verboseLog = options.verboseLog || false;
    this.rootFolder = options.rootFolder;
    this.fileTypes = options.fileTypes;
    this.outputType = options.outputType || 'mp3';
    this.deleteOriginals = options.deleteOriginals || false;
    this.fileProcessor = new AudioFileConverter(this.outputType);
  }

  async processFile(filePath: string) {
    console.log(`Processing file ${filePath}`);
    let result;
    try {
      result = await this.fileProcessor.process(filePath);
    } catch(err) {
      console.error('Error processing file: ', err);
    }
    try {
      if (result && this.deleteOriginals) {
        const isFileExists = await exists(result.resultPath); // if the new file exists, we can delete the old one
        if (isFileExists) await trash([filePath]);
      }
    } catch(err) {
      console.error('Error deleting file: ', err);
    }
  }

  async processFolder(folderPath: string) {
    console.log(`Processing folder ${folderPath}`);
    try {
      const folderContents = await fsp.readdir(folderPath, { withFileTypes: true });
      const fileResArr = [];
      for (const entry of folderContents) {
        const entryPath = path.join(folderPath, entry.name);
        if (entry.isDirectory()) await this.processFolder(entryPath);
        if (entry.isFile()) {
          const ext = path.extname(entry.name).slice(1).toLowerCase();
          if (ext !== this.outputType && this.fileTypes.includes(ext)) {
            const fileRes = this.processFile(entryPath).catch(err => {
              console.warn(`Failed to process file ${entryPath}, error=${err}`);
            });
            fileResArr.push(fileRes);
          }
        }
      };
      return Promise.all(fileResArr);
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
    { name: 'src', alias: 's', type: String, multiple: true },
    { name: 'inputType', alias: 't', type: String, multiple: true },
    { name: 'outputType', alias: 'o', type: String, multiple: false },
    { name: 'keepOriginals', alias: 'k', type: Boolean }
  ];
  const cmdOptions = commandLineArgs(optionDefinitions);

  const rootFolder = (cmdOptions.src && cmdOptions.src.length) ? cmdOptions.src : [__dirname];
  const fileTypes = (cmdOptions.inputType && cmdOptions.inputType.length) ? cmdOptions.inputType : AUDIO_FORMATS;
  const outputType = cmdOptions.outputType || 'mp3';

  const options = {
    verboseLog: cmdOptions.verbose,
    rootFolder,
    fileTypes,
    outputType,
    deleteOriginals: !cmdOptions.keepOriginals
  };
  const folderProcessor = new FolderProcessor(options);
  console.log('Starting');
  (async () => await folderProcessor.start())();
  console.log('Done');
}


main();