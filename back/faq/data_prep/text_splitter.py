def split_text(text, chunk_size=1000, overlap_sentences=1, separators=['\n\n', '.\n', ':\n', '\n', '.']):
    """
    Split text into chunks of size less than chunk_size, ensuring that each chunk is meaningful and retains context.
    If a paragraph is smaller than chunk_size, it is treated as a single chunk.
    If a paragraph is larger than chunk_size, it is split into parts while preserving context.

    Args:
        text (str): The input text to split.
        chunk_size (int): The maximum size of each chunk.
        overlap_sentences (int): The number of overlapping sentences between successive chunks.
        separators (list): A list of separators to use for splitting.

    Returns:
        list: A list of text chunks.
    """
    chunks = []
    paragraphs = text.split('\n\n')

    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue

        if len(paragraph) <= chunk_size:
            chunks.append(paragraph)
            continue

        sentences = []
        start = 0
        text_len = len(paragraph)
        while start < text_len:
            split_idx = -1
            split_sep = None
            for sep in separators:
                idx = paragraph.find(sep, start)
                if idx != -1 and (split_idx == -1 or idx < split_idx):
                    split_idx = idx
                    split_sep = sep
            if split_idx == -1:
                sentences.append(paragraph[start:])
                break
            end = split_idx + len(split_sep)
            sentences.append(paragraph[start:end])
            start = end

        i = 0
        while i < len(sentences):
            chunk = []
            total_len = 0
            j = i
            while j < len(sentences) and total_len + len(sentences[j]) <= chunk_size:
                chunk.append(sentences[j])
                total_len += len(sentences[j])
                j += 1

            if chunk:
                chunks.append(''.join(chunk))

            if j == i:
                chunks.append(sentences[j])
                j += 1

            i = max(j - overlap_sentences, i + 1)

    return chunks
