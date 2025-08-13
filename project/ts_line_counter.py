#!/usr/bin/env python3
"""
TypeScript代码行数统计脚本
统计MCP项目中的TypeScript代码行数

python ts_line_counter.py --output code_line_num.txt
"""

import os
import sys
from pathlib import Path
from typing import Dict, Tuple
import argparse


def is_typescript_file(file_path: Path) -> bool:
    """判断是否为TypeScript文件"""
    return file_path.suffix.lower() in ['.ts', '.tsx']


def count_lines_in_file(file_path: Path) -> Tuple[int, int]:
    """
    统计单个文件的行数
    返回: (总行数, 代码行数)
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        total_lines = len(lines)
        code_lines = 0
        
        for line in lines:
            stripped_line = line.strip()
            # 跳过空行和注释行
            if stripped_line and not stripped_line.startswith('//') and not stripped_line.startswith('/*'):
                code_lines += 1
        
        return total_lines, code_lines
    except Exception as e:
        print(f"读取文件 {file_path} 时出错: {e}")
        return 0, 0


def scan_directory(directory: Path) -> Dict[str, Dict[str, int]]:
    """
    扫描目录，统计TypeScript文件
    返回: {文件夹名: {'files': 文件数, 'total_lines': 总行数, 'code_lines': 代码行数}}
    """
    stats = {}
    
    for item in directory.rglob('*'):
        if item.is_file() and is_typescript_file(item):
            # 获取相对于src目录的路径
            relative_path = item.relative_to(directory)
            folder_name = relative_path.parts[0] if relative_path.parts else 'root'
            
            if folder_name not in stats:
                stats[folder_name] = {'files': 0, 'total_lines': 0, 'code_lines': 0}
            
            total_lines, code_lines = count_lines_in_file(item)
            stats[folder_name]['files'] += 1
            stats[folder_name]['total_lines'] += total_lines
            stats[folder_name]['code_lines'] += code_lines
    
    return stats


def print_stats(stats: Dict[str, Dict[str, int]], src_path: Path):
    """打印统计结果"""
    print("=" * 60)
    print(f"TypeScript代码行数统计 - {src_path}")
    print("=" * 60)
    
    # 按文件夹排序
    sorted_folders = sorted(stats.keys())
    
    total_files = 0
    total_lines = 0
    total_code_lines = 0
    
    print(f"{'文件夹':<20} {'文件数':<8} {'总行数':<10} {'代码行数':<10}")
    print("-" * 60)
    
    for folder in sorted_folders:
        data = stats[folder]
        print(f"{folder:<20} {data['files']:<8} {data['total_lines']:<10} {data['code_lines']:<10}")
        
        total_files += data['files']
        total_lines += data['total_lines']
        total_code_lines += data['code_lines']
    
    print("-" * 60)
    print(f"{'总计':<20} {total_files:<8} {total_lines:<10} {total_code_lines:<10}")
    print("=" * 60)
    
    return total_files, total_lines, total_code_lines


def main():
    parser = argparse.ArgumentParser(description='统计TypeScript代码行数')
    parser.add_argument('--src', default='src', help='源代码目录路径 (默认: src)')
    parser.add_argument('--output', help='输出结果到文件')
    
    args = parser.parse_args()
    
    # 获取项目根目录
    project_root = Path(__file__).parent
    src_path = project_root / args.src
    
    if not src_path.exists():
        print(f"错误: 目录 {src_path} 不存在")
        sys.exit(1)
    
    print(f"正在扫描目录: {src_path}")
    
    # 扫描并统计
    stats = scan_directory(src_path)
    
    if not stats:
        print("未找到TypeScript文件")
        return
    
    # 打印统计结果
    total_files, total_lines, total_code_lines = print_stats(stats, src_path)
    
    # 如果指定了输出文件，保存结果
    if args.output:
        output_path = project_root / args.output
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(f"TypeScript代码行数统计 - {src_path}\n")
            f.write("=" * 60 + "\n")
            f.write(f"{'文件夹':<20} {'文件数':<8} {'总行数':<10} {'代码行数':<10}\n")
            f.write("-" * 60 + "\n")
            
            for folder in sorted(stats.keys()):
                data = stats[folder]
                f.write(f"{folder:<20} {data['files']:<8} {data['total_lines']:<10} {data['code_lines']:<10}\n")
            
            f.write("-" * 60 + "\n")
            f.write(f"{'总计':<20} {total_files:<8} {total_lines:<10} {total_code_lines:<10}\n")
            f.write("=" * 60 + "\n")
        
        print(f"\n统计结果已保存到: {output_path}")


if __name__ == "__main__":
    main() 


# # 基本统计
# python3 ts_line_counter.py

# # 保存到文件
# python3 ts_line_counter.py --output report.txt
# python ts_line_counter.py --output code_line_num.txt

# # 指定其他目录
# python3 ts_line_counter.py --src other_src_dir