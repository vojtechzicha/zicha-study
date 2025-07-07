import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function checkPandocInstallation(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('pandoc --version')
    console.log('Pandoc is installed:', stdout.split('\n')[0])
    return true
  } catch (error) {
    console.error('Pandoc is not installed. Please install it using:')
    console.error('- macOS: brew install pandoc')
    console.error('- Ubuntu/Debian: sudo apt-get install pandoc')
    console.error('- Windows: Download from https://pandoc.org/installing.html')
    return false
  }
}

// Check on module load in development
if (process.env.NODE_ENV === 'development') {
  checkPandocInstallation()
}