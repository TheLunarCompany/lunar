import os
import sys
import importlib.util

from os.path import join
from typing import List, Optional
from types import ModuleType
from typing import List
from sdks import SDK


class NoProxyUseError(Exception):
  def __init__(self, message: str):
    super().__init__(message)
  
  
def _load_module(file_name: str, module_src: str) -> Optional[ModuleType]:
  module_path = join(module_src, file_name)
  module: Optional[ModuleType] = None

  try:
    spec = importlib.util.spec_from_file_location(file_name[:-3], module_path)
    if spec is not None and spec.loader is not None:
      module = importlib.util.module_from_spec(spec)
      
      sys.path.insert(0, module_src)
      
      spec.loader.exec_module(module)
      
      sys.path.pop(0)
      
  except Exception as e:
    print(f"Error importing {module_path}: {e}")
        
  return module
        
def import_skd_files(folder_path: str) -> List[SDK]:
  sdks: List[SDK] = []
  if not os.path.isdir(folder_path):
    print(f"Error: Folder not found: {folder_path}")
    return sdks

  for filename in os.listdir(folder_path):
    if not filename.endswith("_sdk.py"):
      continue
    
    module = _load_module(filename, folder_path)
    if module is None:
      continue
    
    try:
      sdk_class = getattr(module, "load_sdk")
      sdks.append(sdk_class())
      print(f"Successfully imported and loaded file: {filename}")
      
    except AttributeError:
      print(f"Warning: Function 'load_sdk' not found in {filename}")
      continue

  return sdks
