from typing import Dict
from abc import abstractmethod

    
class SDK():
  def __init__(self):
    pass
  
  def get_name(self) -> str:
    return self.__class__.__name__
      
  @abstractmethod
  def test(self) -> bool:
    pass

  @abstractmethod
  async def test_async(self) -> bool:
    pass
  
  @abstractmethod
  def test_stream(self) -> bool:
    pass

  @abstractmethod
  async def test_stream_async(self) -> bool:
    pass
  
  def _valid_headers(self, headers: Dict[str, str]):
    if 'x-lunar-sequence-id' not in headers:
      print(f"{self.get_name()}::Error: Header missing 'x-lunar-sequence-id'")
      print(f"Headers: {headers}")
      return False
    
    return True
  
  def report_error(self, message: str, sdk: str):
    error_message = f"::error sdk={sdk}::{message}"
    print(error_message)
