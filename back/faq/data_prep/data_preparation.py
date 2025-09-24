from faq.data_prep.text_splitter import split_text


async def prepare_data(text):
    # splitted_data = split_text(text, 2000, 10)
    splitted_data = text.split("\n\n")
    data = {}
    for i, chunk_text in enumerate(splitted_data):
        chunk_text = chunk_text.split("\n")
        data[f"chunk_{i}"] = {
            'title': chunk_text[0],
            'text': chunk_text[1]
        }
    return data
