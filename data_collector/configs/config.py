from dotenv import load_dotenv
import os

class Config:
    
    def __init__(self) -> None:
        load_dotenv()
        
    def get_property(self, property_name):
        return os.getenv(property_name)