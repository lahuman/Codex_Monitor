//! Separate desktop store; never opens or migrates the Python application's database.
use crate::business::{Error, Result};
use aws_lc_rs::{aead, rand};
use serde::{Serialize, de::DeserializeOwned};
use std::{
    fs::{self, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
};

const MAX_STORE: u64 = 32 * 1024 * 1024;
const AAD: &[u8] = b"codex-lb-desktop-store-v1";
pub struct Vault {
    dir: PathBuf,
    key: aead::LessSafeKey,
}
fn private_file(path: &Path) -> std::io::Result<std::fs::File> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options.open(path)
}
fn read_bounded(path: &Path, max: u64) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    std::fs::File::open(path)
        .map_err(|_| Error::Storage)?
        .take(max + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| Error::Storage)?;
    if bytes.len() as u64 > max {
        return Err(Error::Storage);
    }
    Ok(bytes)
}
pub fn random_key() -> Result<String> {
    use base64::Engine;
    let mut bytes = [0; 32];
    rand::fill(&mut bytes).map_err(|_| Error::Storage)?;
    Ok(base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes))
}
impl Vault {
    pub fn open(dir: &Path) -> Result<Self> {
        if !dir.exists() {
            let mut builder = fs::DirBuilder::new();
            builder.recursive(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::DirBuilderExt;
                builder.mode(0o700);
            }
            builder.create(dir).map_err(|_| Error::Storage)?;
        }
        let path = dir.join("vault.key");
        if !path.exists() {
            if dir.join("vault.bin").exists() {
                return Err(Error::Storage);
            }
            let mut key = [0; 32];
            rand::fill(&mut key).map_err(|_| Error::Storage)?;
            let mut file = private_file(&path).map_err(|_| Error::Storage)?;
            file.write_all(&key)
                .and_then(|_| file.sync_all())
                .map_err(|_| Error::Storage)?;
        }
        let bytes = read_bounded(&path, 32)?;
        let key = aead::UnboundKey::new(&aead::AES_256_GCM, &bytes).map_err(|_| Error::Storage)?;
        Ok(Self {
            dir: dir.to_owned(),
            key: aead::LessSafeKey::new(key),
        })
    }
    pub fn load<T: DeserializeOwned>(&self) -> Result<Option<T>> {
        let path = self.dir.join("vault.bin");
        if !path.exists() {
            return Ok(None);
        }
        let data = read_bounded(&path, MAX_STORE)?;
        if data.len() < 12 {
            return Err(Error::Storage);
        }
        let nonce: [u8; 12] = data[..12].try_into().map_err(|_| Error::Storage)?;
        let mut ciphertext = data[12..].to_vec();
        let plain = self
            .key
            .open_in_place(
                aead::Nonce::assume_unique_for_key(nonce),
                aead::Aad::from(AAD),
                &mut ciphertext,
            )
            .map_err(|_| Error::Storage)?;
        serde_json::from_slice(plain)
            .map(Some)
            .map_err(|_| Error::Storage)
    }
    pub fn save<T: Serialize>(&self, value: &T) -> Result<()> {
        let mut data = serde_json::to_vec(value).map_err(|_| Error::Storage)?;
        if data.len() as u64 > MAX_STORE - 64 {
            return Err(Error::Storage);
        }
        let mut nonce = [0; 12];
        rand::fill(&mut nonce).map_err(|_| Error::Storage)?;
        self.key
            .seal_in_place_append_tag(
                aead::Nonce::assume_unique_for_key(nonce),
                aead::Aad::from(AAD),
                &mut data,
            )
            .map_err(|_| Error::Storage)?;
        let temp = self.dir.join(format!("{}.tmp", random_key()?));
        let result = (|| {
            let mut file = private_file(&temp).map_err(|_| Error::Storage)?;
            file.write_all(&nonce)
                .and_then(|_| file.write_all(&data))
                .and_then(|_| file.sync_all())
                .map_err(|_| Error::Storage)?;
            fs::rename(&temp, self.dir.join("vault.bin")).map_err(|_| Error::Storage)?;
            // Directory synchronization is Unix-only; file contents were flushed above.
            #[cfg(unix)]
            fs::File::open(&self.dir)
                .and_then(|dir| dir.sync_all())
                .map_err(|_| Error::Storage)?;
            Ok(())
        })();
        if result.is_err() {
            let _ = fs::remove_file(temp);
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn repeated_atomic_saves_survive_reopening() {
        let directory = tempfile::tempdir().unwrap();
        let vault = Vault::open(directory.path()).unwrap();
        vault.save(&vec!["first"]).unwrap();
        vault.save(&vec!["second", "updated"]).unwrap();
        let reopened = Vault::open(directory.path()).unwrap();
        assert_eq!(
            reopened.load::<Vec<String>>().unwrap().unwrap(),
            vec!["second", "updated"]
        );
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 2);
    }
}
