import * as Keychain from 'react-native-keychain';
import JailMonkey from 'jail-monkey';
import CryptoJS from 'crypto-js';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export class SecurityService {
  
  static isDeviceCompromised(): boolean {
    return JailMonkey.isJailBroken() || JailMonkey.canMockLocation();
  }

  static async getOrCreateEncryptionKey(): Promise<string> {
    try {
      const credentials = await Keychain.getGenericPassword();
      
      if (credentials) {
        return credentials.password;
      } else {
        const salt = CryptoJS.lib.WordArray.random(128/8).toString();
        const deviceUUID = uuidv4(); 
        const appSecret = "NETRA_HACKATHON_SECURE_SECRET_V1";
        
        const key = CryptoJS.PBKDF2(deviceUUID + appSecret, salt, { 
          keySize: 256/32, 
          iterations: 1000 
        }).toString();
        
        await Keychain.setGenericPassword('netra_db_user', key);
        return key;
      }
    } catch (err) {
      console.warn("Keychain error, falling back to static key:", err);
      return "FALLBACK_HACKATHON_KEY_SECURE_123456";
    }
  }

  static generateChecksum(data: string): string {
    return CryptoJS.SHA256(data).toString();
  }
}
