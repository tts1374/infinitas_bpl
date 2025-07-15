import xml.etree.ElementTree as ET
import json

class ResultService:
    def __init__(self, settings, user_token):
        self.settings = settings
        self.user_token = user_token

    def parse_result(self, xml_content):
        root = ET.fromstring(xml_content)
        first_item = root.find('item')
        if first_item is None:
            raise ValueError("XMLに<item>がありません")

        result_data = {
            "mode": self.settings['mode'],
            "roomId": self.settings['room_pass'],
            "userId": self.user_token,
            "name": self.settings['djname'],
            "result": {child.tag: child.text for child in first_item}
        }
        return result_data

    def to_json(self, data):
        return json.dumps(data, ensure_ascii=False, indent=2)
