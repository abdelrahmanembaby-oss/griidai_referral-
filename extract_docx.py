import zipfile
import xml.etree.ElementTree as ET

def read_docx(path):
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    text = []
    with zipfile.ZipFile(path) as docx:
        tree = ET.fromstring(docx.read('word/document.xml'))
        for paragraph in tree.findall('.//w:p', ns):
            para_text = "".join([t.text for r in paragraph.findall('.//w:r', ns) for t in r.findall('.//w:t', ns) if t.text])
            if para_text.strip():
                text.append(para_text)
    return '\n'.join(text)

if __name__ == '__main__':
    with open('frontend_plan.txt', 'w', encoding='utf-8') as f:
        f.write(read_docx('griidai_frontend_plan.docx'))
    with open('backend_plan.txt', 'w', encoding='utf-8') as f:
        f.write(read_docx('griidai_backend_plan.docx'))
