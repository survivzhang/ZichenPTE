# Builds public/dicts/PTE_templates.json from the Notion page「PTE 模板速查」(copied in by hand).
# Run from the repo root: python3 scripts/build-pte-templates.py. It prints the chapter sizes for
# the PTE_templates entry in src/resources/dictionary.ts, which has to match.
import json
# (chapter name, [(sentence read aloud, template with blanks)])
chapters = [
 ("DI · 数据图", [
  ("The following graph gives us information about the population of Australia.", "The following graph gives us information about [标题]."),
  ("According to the graph, the items include cars, buses, trains and bicycles.", "According to the graph, the items include [列举关键信息]."),
  ("What's more, the largest number is fifty for cars, which is around half of the total, followed by buses.", "What's more, the largest number is … for …, which is around …, followed by …."),
  ("Moreover, the smallest number is around five for bicycles.", "Moreover, the smallest number is around … for …."),
  ("The largest part is cars, which is represented by red.", "The largest part is …, which is represented by [red]."),
  ("The blue one means that many people take the bus.", "The blue one means that …."),
  ("When it comes to trains, it means that more people travel by rail.", "When it comes to …, it means that …."),
  ("In conclusion, cars are the most popular way to travel.", "(In conclusion, ….)"),
 ]),
 ("DI · 流程图", [
  ("As we can see from the graph, the first step is collecting the raw materials.", "As we can see from the graph, the first step is …."),
  ("After that, the second step is washing them.", "After that, the second step is …."),
  ("Moreover, the following step is cutting them into pieces.", "Moreover, the following step is …."),
  ("In addition, the next step is cooking them at a high temperature.", "In addition, the next step is …."),
  ("The final step is packing the products.", "The final step is …."),
 ]),
 ("DI · 地图 / 图片", [
  ("On the left side of the picture, we can see a large river.", "On the left / west side of the picture / map, we can see …."),
  ("On the right side of the map, there are some tall buildings.", "On the right / east side of the graph / map, there are …."),
  ("In the background of the image, there are green mountains.", "In the background of the image, there are …."),
  ("At the top of the image, there is a clear blue sky.", "At the top / bottom of the image, …."),
 ]),
 ("RL · 复述讲座", [
  ("This lecture talked about climate change.", "This lecture talked about …."),
  ("To begin with, the speaker mentioned that global temperatures are rising.", "To begin with, the speaker mentioned that …."),
  ("What's more, the speaker emphasized that human activities are the main cause.", "What's more, the speaker emphasized that …."),
  ("In addition, the speaker believed that renewable energy could help.", "In addition, the speaker believed that …."),
  ("Finally, the speaker said that everyone should take action.", "Finally, the speaker said that …."),
 ]),
 ("SGD · 小组讨论总结", [
  ("The three students are talking about online learning.", "The three students are talking about …."),
  ("To begin with, the first student mentioned that it is flexible and convenient.", "To begin with, the first student mentioned that …."),
  ("Moreover, the second student talked about the lack of interaction.", "Moreover, the second student talked about …."),
  ("In addition, the third student believed that a mix of both is the best choice.", "In addition, the third student believed that …."),
  ("In conclusion, online learning has both advantages and disadvantages.", "(In conclusion, ….)"),
 ]),
 ("RTS · 情景回应", [
  ("Hi, I hope you are doing well.", "Hi, I hope you are doing well."),
  ("I'm sorry to bother you, but I would like to talk to you about the group project.", "I'm sorry to bother you, but I would like to talk to you about …（原文）."),
  ("Here is the situation that I cannot attend the meeting on Friday.", "(Here is the situation that ….)"),
  ("So all I want to say is that we could move the meeting to Monday.", "So all I want to say is that …（解决方案）."),
  ("Thank you for your time. Hope you have a good day.", "Thank you for your time. Hope you have a good day."),
 ]),
 ("SST · 听力总结", [
  ("The lecture mainly talks about the topic of separation of powers.", "The lecture mainly talks about the topic of …."),
  ("Firstly, the speaker considers that separation of powers could maintain balance and protect freedom.", "Firstly, the speaker considers that …."),
  ("Secondly, the speaker thinks that the first power makes laws, and the second power carries out laws.", "Secondly, the speaker thinks that …."),
  ("In addition, the speaker believes that this structure could improve fairness and stability.", "In addition, the speaker believes that …."),
 ]),
]
links = [("开头", ["To begin with", "First of all", "Firstly"]),
         ("补充", ["What's more", "Moreover", "In addition", "Furthermore", "Besides"]),
         ("顺序", ["After that", "Then", "Next", "Following that"]),
         ("对比", ["However", "In contrast", "On the other hand"]),
         ("结尾", ["Finally", "Last but not least", "In conclusion", "Overall"])]
chapters.append(("连接词库", [(w, f"连接词 · {use}（轮着用，不连着重复）") for use, ws in links for w in ws]))

words = []
meta = []
for name, items in chapters:
    meta.append({"name": name, "length": len(items)})
    for text, tpl in items:
        words.append({"name": text, "trans": [tpl], "usphone": "", "ukphone": ""})
json.dump(words, open("public/dicts/PTE_templates.json", "w"), ensure_ascii=False, indent=2)
print(json.dumps(meta, ensure_ascii=False), len(words))
