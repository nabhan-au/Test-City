from antlr4 import *
import os
import pathlib

from data_collector.util.path import PathBuilder
from data_collector.util.repo import RepositoryAnalyzer
from project_analyzer.src.antlr_ast.PythonLexer import PythonLexer
from project_analyzer.src.antlr_ast.PythonParser import PythonParser
from project_analyzer.src.antlr_ast.line_list_generator import LineListGenerator


def main():
    current_path = os.path.dirname(os.path.abspath(__file__))
    listener = LineListGenerator()
    # listener = PythonParserListener()

    pb = PathBuilder("openhtf")
    analyzer = RepositoryAnalyzer(pb)
    filename_and_line_list = {}
    for file in analyzer.get_all_filenames():
        if not pb.get_filename(file.filename).endswith('.py'):
            print('This is not a python file.')
            continue
        try:
            input_stream = FileStream(file.filename)
        except Exception as e:
            print(f'An error occurred: {e}')
            continue
        lexer = PythonLexer(input_stream)
        stream = CommonTokenStream(lexer)
        parser = PythonParser(stream)
        walker = ParseTreeWalker()
        walker.walk(listener, parser.root())
        filename_and_line_list[file.filename] = listener.line_list
        listener.line_list = []
        print(file.filename, filename_and_line_list[file.filename])
    print(filename_and_line_list)

    # input_file = FileStream(f'{current_path}/../../../repo/openhtf/openhtf/core/monitors.py')
    # lexer = PythonLexer(input_file)
    # stream = CommonTokenStream(lexer)
    # parser = PythonParser(stream)
    # walker = ParseTreeWalker()
    # walker.walk(listener, parser.root())
    # print(listener.line_list)


if __name__ == "__main__":
    main()
