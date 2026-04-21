import zipfile
import xml.etree.ElementTree as ET
import sys

def read_docx(path):
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    text = []
    with zipfile.ZipFile(path) as docx:
        xml_content = docx.read('word/document.xml')
        tree = ET.fromstring(xml_content)
        for paragraph in tree.findall('.//w:p', ns):
            para_text = "".join([t.text for r in paragraph.findall('.//w:r', ns) for t in r.findall('.//w:t', ns) if t.text])
            if para_text.strip():
                text.append(para_text)
    return '\n'.join(text)

if __name__ == '__main__':
    for path in sys.argv[1:]:
        print(f"\n--- Reading {path} ---")
        try:
            print(read_docx(path))
        except Exception as e:
            print(f"Error reading {path}: {e}")
